// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ===== HELPERS =====
const $ = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

function loadData(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== DATE DISPLAY =====
function updateDateDisplay() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  $('dateDisplay').textContent = now.toLocaleDateString('de-DE', options);
}

// ===== NAVIGATION =====
function switchPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('page-' + page).classList.add('active');
  btn.classList.add('active');

  if (page === 'history') renderHistory();
  if (page === 'notes') renderNotes();
  if (page === 'reminders') renderReminders();
}

// ===== TODOS =====
function getTodos() {
  return loadData('myday_todos_' + todayKey());
}

function saveTodos(todos) {
  saveData('myday_todos_' + todayKey(), todos);
}

function addTodo() {
  const input = $('todoInput');
  const text = input.value.trim();
  if (!text) return;

  const todos = getTodos();
  todos.push({ id: generateId(), text, done: false, createdAt: new Date().toISOString() });
  saveTodos(todos);
  input.value = '';
  renderTodos();
}

function toggleTodo(id) {
  const todos = getTodos();
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    saveTodos(todos);
    renderTodos();
  }
}

function deleteTodo(id) {
  let todos = getTodos();
  todos = todos.filter(t => t.id !== id);
  saveTodos(todos);
  renderTodos();
}

function renderTodos() {
  const todos = getTodos();
  const el = $('todoList');

  if (todos.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="emoji">✅</div><p>Keine Aufgaben - Zeit zum Entspannen!</p></div>';
    return;
  }

  el.innerHTML = todos.map(t => `
    <div class="todo-item">
      <div class="todo-check ${t.done ? 'done' : ''}" onclick="toggleTodo('${t.id}')"></div>
      <span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span>
      <button class="todo-delete" onclick="deleteTodo('${t.id}')">✕</button>
    </div>
  `).join('');
}

// Enter key for todo input
document.addEventListener('DOMContentLoaded', () => {
  $('todoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });
});

// ===== QUICK NOTES (Journal) =====
function saveQuickNote() {
  const textarea = $('quickNote');
  const text = textarea.value.trim();
  if (!text) return;

  const entries = loadData('myday_journal');
  entries.push({
    id: generateId(),
    text,
    date: todayKey(),
    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString()
  });
  saveData('myday_journal', entries);
  textarea.value = '';

  showToast('Eintrag gespeichert!');
}

// ===== NOTES =====
let editingNoteId = null;

function openNoteModal(id = null) {
  editingNoteId = id;
  if (id) {
    const notes = loadData('myday_notes');
    const note = notes.find(n => n.id === id);
    if (note) {
      $('noteTitle').value = note.title;
      $('noteContent').value = note.content;
      $('noteModalTitle').textContent = 'Notiz bearbeiten';
    }
  } else {
    $('noteTitle').value = '';
    $('noteContent').value = '';
    $('noteModalTitle').textContent = 'Neue Notiz';
  }
  $('noteModal').classList.add('open');
}

function closeNoteModal() {
  $('noteModal').classList.remove('open');
  editingNoteId = null;
}

function saveNote() {
  const title = $('noteTitle').value.trim();
  const content = $('noteContent').value.trim();
  if (!title && !content) return;

  const notes = loadData('myday_notes');

  if (editingNoteId) {
    const note = notes.find(n => n.id === editingNoteId);
    if (note) {
      note.title = title || 'Ohne Titel';
      note.content = content;
      note.updatedAt = new Date().toISOString();
    }
  } else {
    notes.unshift({
      id: generateId(),
      title: title || 'Ohne Titel',
      content,
      date: todayKey(),
      createdAt: new Date().toISOString()
    });
  }

  saveData('myday_notes', notes);
  closeNoteModal();
  renderNotes();
  showToast('Notiz gespeichert!');
}

function deleteNote(id) {
  let notes = loadData('myday_notes');
  notes = notes.filter(n => n.id !== id);
  saveData('myday_notes', notes);
  renderNotes();
}

function renderNotes() {
  const notes = loadData('myday_notes');
  const el = $('notesList');

  if (notes.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="emoji">📝</div><p>Noch keine Notizen. Leg los!</p></div>';
    return;
  }

  el.innerHTML = notes.map(n => `
    <div class="card" onclick="openNoteModal('${n.id}')">
      <div class="note-date">${formatDate(n.date)}</div>
      <div class="note-title">${escapeHtml(n.title)}</div>
      <div class="note-preview">${escapeHtml(n.content)}</div>
      <button class="btn btn-sm btn-danger" style="margin-top:10px" onclick="event.stopPropagation(); deleteNote('${n.id}')">Loeschen</button>
    </div>
  `).join('');
}

// ===== REMINDERS =====
function openReminderModal() {
  $('reminderText').value = '';
  $('reminderDate').value = todayKey();
  $('reminderTime').value = '';
  $('reminderModal').classList.add('open');
}

function closeReminderModal() {
  $('reminderModal').classList.remove('open');
}

function saveReminder() {
  const text = $('reminderText').value.trim();
  const date = $('reminderDate').value;
  const time = $('reminderTime').value;
  if (!text || !date || !time) {
    showToast('Bitte alles ausfuellen!');
    return;
  }

  const reminders = loadData('myday_reminders');
  const reminder = {
    id: generateId(),
    text,
    date,
    time,
    datetime: `${date}T${time}`,
    createdAt: new Date().toISOString()
  };
  reminders.push(reminder);
  saveData('myday_reminders', reminders);

  // Schedule notification
  scheduleNotification(reminder);

  closeReminderModal();
  renderReminders();
  showToast('Erinnerung gespeichert!');
}

function scheduleNotification(reminder) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  if (Notification.permission === 'granted' && navigator.serviceWorker.controller) {
    const targetTime = new Date(reminder.datetime).getTime();
    const delay = targetTime - Date.now();

    if (delay > 0) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_REMINDER',
        title: 'MyDay Erinnerung',
        body: reminder.text,
        delay
      });
    }
  }
}

function deleteReminder(id) {
  let reminders = loadData('myday_reminders');
  reminders = reminders.filter(r => r.id !== id);
  saveData('myday_reminders', reminders);
  renderReminders();
}

function renderReminders() {
  const reminders = loadData('myday_reminders');
  const el = $('reminderList');

  // Sort by datetime
  reminders.sort((a, b) => a.datetime.localeCompare(b.datetime));

  // Split into upcoming and past
  const now = new Date();
  const upcoming = reminders.filter(r => new Date(r.datetime) >= now);
  const past = reminders.filter(r => new Date(r.datetime) < now);

  if (reminders.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="emoji">🔔</div><p>Keine Erinnerungen. Brauchst du eine?</p></div>';
    return;
  }

  let html = '';

  if (upcoming.length > 0) {
    html += '<div class="section-title" style="font-size:0.9rem;margin-top:8px">Anstehend</div>';
    html += upcoming.map(r => renderReminderItem(r)).join('');
  }

  if (past.length > 0) {
    html += '<div class="section-title" style="font-size:0.9rem;margin-top:16px;color:var(--text-muted)">Vergangen</div>';
    html += past.map(r => renderReminderItem(r, true)).join('');
  }

  el.innerHTML = html;
}

function renderReminderItem(r, isPast = false) {
  return `
    <div class="reminder-item" style="${isPast ? 'opacity:0.5' : ''}">
      <div class="reminder-time">${r.time}</div>
      <div>
        <div class="reminder-text">${escapeHtml(r.text)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${formatDate(r.date)}</div>
      </div>
      <button class="todo-delete" onclick="deleteReminder('${r.id}')">✕</button>
    </div>
  `;
}

// ===== HISTORY =====
function renderHistory() {
  // Stats
  const allTodoKeys = Object.keys(localStorage).filter(k => k.startsWith('myday_todos_'));
  let totalDone = 0;
  let activeDays = new Set();

  allTodoKeys.forEach(k => {
    const todos = loadData(k.replace('myday_', ''));
    const date = k.replace('myday_todos_', '');
    const done = todos.filter(t => t.done).length;
    totalDone += done;
    if (todos.length > 0) activeDays.add(date);
  });

  const journal = loadData('myday_journal');
  const notes = loadData('myday_notes');
  const reminders = loadData('myday_reminders');

  journal.forEach(j => activeDays.add(j.date));

  // Calculate streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activeDays.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  $('statTasks').textContent = totalDone;
  $('statNotes').textContent = notes.length;
  $('statStreak').textContent = streak;
  $('statReminders').textContent = reminders.length;

  // Journal entries grouped by date
  const el = $('historyList');
  const grouped = {};

  journal.forEach(entry => {
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(entry);
  });

  const sortedDates = Object.keys(grouped).sort().reverse();

  if (sortedDates.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="emoji">📅</div><p>Noch keine Eintraege. Schreib auf der Heute-Seite was du gemacht hast!</p></div>';
    return;
  }

  el.innerHTML = sortedDates.map(date => `
    <div class="history-day">
      <div class="history-date">${formatDate(date)}</div>
      ${grouped[date].map(entry => `
        <div class="card">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">${entry.time} Uhr</div>
          <div style="font-size:0.95rem;white-space:pre-wrap">${escapeHtml(entry.text)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ===== TOAST =====
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--success);
    color: white;
    padding: 10px 24px;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    z-index: 300;
    animation: fadeIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ===== ESCAPE HTML =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== REQUEST NOTIFICATION PERMISSION =====
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ===== INIT =====
updateDateDisplay();
renderTodos();
requestNotificationPermission();

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
    }
  });
});
