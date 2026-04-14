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
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ===== DATE DISPLAY =====
function updateDates() {
  const now = new Date();
  $('topbarDate').textContent = now.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  $('todayDateLong').textContent = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('journalTime').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ===== NAVIGATION =====
const pageConfig = {
  today: { icon: '&#9788;', title: 'Heute' },
  notes: { icon: '&#128196;', title: 'Notizen' },
  reminders: { icon: '&#128276;', title: 'Erinnerungen' },
  history: { icon: '&#128202;', title: 'Verlauf' },
  ai: { icon: '&#10024;', title: 'KI' }
};

function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  $('page-' + name).classList.add('active');
  document.querySelector(`.nav-btn[data-page="${name}"]`).classList.add('active');

  const cfg = pageConfig[name];
  $('topbarIcon').innerHTML = cfg.icon;
  $('topbarTitle').textContent = cfg.title;

  if (name === 'notes') renderNotes();
  if (name === 'reminders') renderReminders();
  if (name === 'history') renderHistory();
  if (name === 'today') renderTodayEntries();
  if (name === 'ai') initAiPage();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

// ===== TODOS =====
function getTodos() { return loadData('myday_todos_' + todayKey()); }
function saveTodos(todos) { saveData('myday_todos_' + todayKey(), todos); }

function addTodo() {
  const input = $('todoInput');
  const text = input.value.trim();
  if (!text) return;
  const todos = getTodos();
  todos.push({ id: generateId(), text, done: false });
  saveTodos(todos);
  input.value = '';
  renderTodos();
}

function toggleTodo(id) {
  const todos = getTodos();
  const t = todos.find(x => x.id === id);
  if (t) { t.done = !t.done; saveTodos(todos); renderTodos(); }
}

function deleteTodo(id) {
  saveTodos(getTodos().filter(t => t.id !== id));
  renderTodos();
}

function renderTodos() {
  const todos = getTodos();
  const el = $('todoList');
  if (!todos.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = todos.map(t => `
    <div class="todo-item">
      <div class="todo-checkbox ${t.done ? 'checked' : ''}" onclick="toggleTodo('${t.id}')"></div>
      <div class="todo-content ${t.done ? 'checked' : ''}">${escapeHtml(t.text)}</div>
      <div class="todo-actions">
        <button class="icon-btn" onclick="deleteTodo('${t.id}')">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

$('todoInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

// ===== JOURNAL =====
function saveQuickNote() {
  const ta = $('quickNote');
  const text = ta.value.trim();
  if (!text) return;
  const entries = loadData('myday_journal');
  entries.push({
    id: generateId(),
    text,
    date: todayKey(),
    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  });
  saveData('myday_journal', entries);
  ta.value = '';
  showToast('Eintrag gespeichert');
  renderTodayEntries();
}

function renderTodayEntries() {
  const entries = loadData('myday_journal').filter(e => e.date === todayKey());
  const el = $('todayEntries');
  if (!entries.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<hr class="divider"><div class="section-label">Heutige Eintraege</div>' +
    entries.reverse().map(e => `
      <div class="history-entry">
        <div class="history-entry-time">${e.time}</div>
        ${escapeHtml(e.text)}
      </div>
    `).join('');
}

// ===== NOTES =====
let editingNoteId = null;

function openNoteEditor(id = null) {
  editingNoteId = id;
  if (id) {
    const note = loadData('myday_notes').find(n => n.id === id);
    if (note) {
      $('noteTitle').value = note.title;
      $('noteContent').value = note.content;
    }
    $('noteDeleteBtn').style.display = '';
  } else {
    $('noteTitle').value = '';
    $('noteContent').value = '';
    $('noteDeleteBtn').style.display = 'none';
  }
  $('noteEditor').classList.add('open');
  setTimeout(() => (id ? $('noteContent') : $('noteTitle')).focus(), 100);
}

function closeNoteEditor() {
  $('noteEditor').classList.remove('open');
  editingNoteId = null;
}

function saveNote() {
  const title = $('noteTitle').value.trim();
  const content = $('noteContent').value.trim();
  if (!title && !content) { closeNoteEditor(); return; }
  const notes = loadData('myday_notes');
  if (editingNoteId) {
    const n = notes.find(x => x.id === editingNoteId);
    if (n) { n.title = title || 'Ohne Titel'; n.content = content; n.updatedAt = new Date().toISOString(); }
  } else {
    notes.unshift({
      id: generateId(), title: title || 'Ohne Titel', content,
      date: todayKey(), createdAt: new Date().toISOString()
    });
  }
  saveData('myday_notes', notes);
  closeNoteEditor();
  renderNotes();
  showToast('Gespeichert');
}

function deleteCurrentNote() {
  if (!editingNoteId) return;
  saveData('myday_notes', loadData('myday_notes').filter(n => n.id !== editingNoteId));
  closeNoteEditor();
  renderNotes();
  showToast('Geloescht');
}

function renderNotes() {
  const notes = loadData('myday_notes');
  const el = $('notesList');
  if (!notes.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">&#128196;</div><p>Keine Notizen</p></div>';
    return;
  }
  el.innerHTML = notes.map(n => `
    <div class="note-row" onclick="openNoteEditor('${n.id}')">
      <div class="note-icon">&#128196;</div>
      <div class="note-info">
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-subtitle">${escapeHtml(n.content).slice(0, 60) || 'Leer'}</div>
      </div>
    </div>
  `).join('');
}

// ===== REMINDERS WITH WORKING NOTIFICATIONS =====
let reminderTimers = [];

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
  if (!text || !date || !time) { showToast('Bitte alles ausfuellen'); return; }
  const reminders = loadData('myday_reminders');
  reminders.push({ id: generateId(), text, date, time, datetime: `${date}T${time}` });
  saveData('myday_reminders', reminders);
  closeReminderModal();
  renderReminders();
  scheduleAllReminders();
  showToast('Erinnerung gespeichert');
}

function deleteReminder(id) {
  saveData('myday_reminders', loadData('myday_reminders').filter(r => r.id !== id));
  renderReminders();
  scheduleAllReminders();
}

function renderReminders() {
  const reminders = loadData('myday_reminders');
  const el = $('reminderList');
  const now = new Date();

  reminders.sort((a, b) => a.datetime.localeCompare(b.datetime));
  const upcoming = reminders.filter(r => new Date(r.datetime) >= now);
  const past = reminders.filter(r => new Date(r.datetime) < now);

  if (!reminders.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">&#128276;</div><p>Keine Erinnerungen</p></div>';
    return;
  }

  let html = '';
  if (upcoming.length) {
    html += '<div class="section-label" style="margin-top:8px">Anstehend</div>';
    html += upcoming.map(r => reminderRowHtml(r, false)).join('');
  }
  if (past.length) {
    html += '<div class="section-label" style="margin-top:16px">Vergangen</div>';
    html += past.map(r => reminderRowHtml(r, true)).join('');
  }
  el.innerHTML = html;
}

function reminderRowHtml(r, isPast) {
  return `
    <div class="reminder-row ${isPast ? 'past-row' : ''}">
      <div class="reminder-badge ${isPast ? 'past' : 'upcoming'}">${r.time}</div>
      <div class="reminder-info">
        <div class="reminder-label">${escapeHtml(r.text)}</div>
        <div class="reminder-date">${formatDateShort(r.date)}</div>
      </div>
      <button class="icon-btn" onclick="deleteReminder('${r.id}')">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
      </button>
    </div>
  `;
}

// === Reliable reminder notification system ===
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        showToast('Benachrichtigungen aktiviert');
      }
    });
  }
}

function scheduleAllReminders() {
  // Clear existing timers
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers = [];

  const reminders = loadData('myday_reminders');
  const now = Date.now();

  reminders.forEach(r => {
    const target = new Date(r.datetime).getTime();
    const delay = target - now;
    if (delay > 0 && delay < 86400000 * 7) { // within 7 days
      const timer = setTimeout(() => fireReminder(r), delay);
      reminderTimers.push(timer);
    }
  });
}

function fireReminder(reminder) {
  // Try native notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('MyDay Erinnerung', {
      body: reminder.text,
      icon: './icon-192.svg',
      tag: reminder.id,
      requireInteraction: true
    });
  }

  // Also show in-app alert as fallback
  showReminderAlert(reminder.text);

  // Vibrate if supported
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

function showReminderAlert(text) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999;
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  overlay.innerHTML = `
    <div style="background:#202020;border-radius:12px;padding:24px;max-width:340px;width:100%;text-align:center">
      <div style="font-size:2rem;margin-bottom:12px">&#128276;</div>
      <div style="font-size:1rem;font-weight:600;margin-bottom:6px">Erinnerung</div>
      <div style="font-size:0.95rem;color:#9b9b9b;margin-bottom:20px">${escapeHtml(text)}</div>
      <button class="btn btn-full" onclick="this.closest('div[style]').parentElement.remove()">OK</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Check reminders every 30 seconds as backup
setInterval(() => {
  const reminders = loadData('myday_reminders');
  const now = new Date();
  const checked = loadData('myday_fired_reminders', []);

  reminders.forEach(r => {
    const target = new Date(r.datetime);
    const diff = now - target;
    // Fire if within last 60 seconds and not already fired
    if (diff >= 0 && diff < 60000 && !checked.includes(r.id)) {
      checked.push(r.id);
      saveData('myday_fired_reminders', checked);
      fireReminder(r);
    }
  });
}, 30000);

// ===== HISTORY =====
function renderHistory() {
  const allKeys = Object.keys(localStorage).filter(k => k.startsWith('myday_todos_'));
  let totalDone = 0;
  const activeDays = new Set();

  allKeys.forEach(k => {
    const todos = loadData(k.replace('myday_', ''));
    const date = k.replace('myday_todos_', '');
    totalDone += todos.filter(t => t.done).length;
    if (todos.length) activeDays.add(date);
  });

  const journal = loadData('myday_journal');
  const notes = loadData('myday_notes');
  const reminders = loadData('myday_reminders');
  journal.forEach(j => activeDays.add(j.date));

  // Streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activeDays.has(key)) streak++;
    else if (i > 0) break;
  }

  $('statTasks').textContent = totalDone;
  $('statNotes').textContent = notes.length;
  $('statStreak').textContent = streak;
  $('statReminders').textContent = reminders.length;

  // Journal grouped
  const grouped = {};
  journal.forEach(e => { (grouped[e.date] = grouped[e.date] || []).push(e); });
  const dates = Object.keys(grouped).sort().reverse();

  const el = $('historyList');
  if (!dates.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">&#128197;</div><p>Noch keine Eintraege</p></div>';
    return;
  }

  el.innerHTML = dates.map(date => `
    <div class="history-group">
      <div class="history-date">${formatDate(date)}</div>
      ${grouped[date].map(e => `
        <div class="history-entry">
          <div class="history-entry-time">${e.time}</div>
          ${escapeHtml(e.text)}
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ===== AI CHAT (Google Gemini - Free) =====
function getApiKey() {
  return localStorage.getItem('myday_or_key') || '';
}

function saveApiKey() {
  const key = $('apiKeyInput').value.trim();
  if (!key) { showToast('Bitte Key eingeben'); return; }
  localStorage.setItem('myday_or_key', key);
  showAiChat();
  showToast('KI verbunden!');
}

function showAiChat() {
  $('aiSetup').style.display = 'none';
  $('aiChat').style.display = 'flex';
}

function initAiPage() {
  if (getApiKey()) {
    showAiChat();
  }
}

function gatherContext() {
  const todos = getTodos();
  const journal = loadData('myday_journal');
  const notes = loadData('myday_notes');
  const reminders = loadData('myday_reminders');

  const todayEntries = journal.filter(e => e.date === todayKey());
  const recentEntries = journal.slice(-10);

  let ctx = `Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.\n\n`;

  if (todos.length) {
    ctx += `HEUTIGE AUFGABEN:\n`;
    todos.forEach(t => ctx += `- [${t.done ? 'x' : ' '}] ${t.text}\n`);
    ctx += '\n';
  }

  if (todayEntries.length) {
    ctx += `HEUTIGE TAGEBUCH-EINTRAEGE:\n`;
    todayEntries.forEach(e => ctx += `- ${e.time}: ${e.text}\n`);
    ctx += '\n';
  }

  if (recentEntries.length > todayEntries.length) {
    ctx += `LETZTE EINTRAEGE (vergangene Tage):\n`;
    recentEntries.filter(e => e.date !== todayKey()).forEach(e => ctx += `- ${e.date} ${e.time}: ${e.text}\n`);
    ctx += '\n';
  }

  if (notes.length) {
    ctx += `NOTIZEN (${notes.length} Stueck):\n`;
    notes.slice(0, 5).forEach(n => ctx += `- "${n.title}": ${n.content.slice(0, 100)}\n`);
    ctx += '\n';
  }

  if (reminders.length) {
    ctx += `ERINNERUNGEN:\n`;
    reminders.forEach(r => ctx += `- ${r.date} ${r.time}: ${r.text}\n`);
  }

  return ctx;
}

// Chat history for context
let chatHistory = [];

function addChatMessage(text, type) {
  const el = $('chatMessages');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}`;
  msg.textContent = text;
  el.appendChild(msg);
  el.scrollTop = el.scrollHeight;
  return msg;
}

function sendAiSuggestion(text) {
  $('chatInput').value = '';
  sendChatMessage(text);
}

function sendChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendChatMessage(text);
}

// Detect if user wants to create a journal entry, task, or reminder
function handleAction(userText) {
  const lower = userText.toLowerCase();

  // Journal / Tagebuch
  if (lower.includes('tagebuch') || lower.includes('eintrag') || lower.includes('einfuegen') || lower.includes('einfügen') || lower.includes('speicher')) {
    // Extract content - remove action words
    let content = userText
      .replace(/kannst du|bitte|mir|ins tagebuch|in mein tagebuch|einfuegen|einfügen|einen eintrag|eintrag|machen|schreib|speicher|speichern|was ich|heute|gemacht habe|,?\s*dass ich/gi, '')
      .replace(/^\s*[,:.\-]+\s*/, '')
      .trim();

    // If content is too short, use original message
    if (content.length < 5) {
      content = userText.replace(/kannst du.*?(tagebuch|eintrag).*?[:,]?\s*/i, '').trim();
    }

    if (content.length > 2) {
      const entries = loadData('myday_journal');
      entries.push({
        id: generateId(),
        text: content,
        date: todayKey(),
        time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      });
      saveData('myday_journal', entries);
      renderTodayEntries();
      return content;
    }
  }

  // Task / Aufgabe
  if (lower.includes('aufgabe') || lower.includes('todo') || lower.includes('zu erledigen')) {
    let task = userText.replace(/.*?(aufgabe|todo|zu erledigen)[:\s]*/i, '').trim();
    if (task.length > 2) {
      const todos = getTodos();
      todos.push({ id: generateId(), text: task, done: false });
      saveTodos(todos);
      renderTodos();
      return '__task__' + task;
    }
  }

  return null;
}

async function sendChatMessage(userText) {
  addChatMessage(userText, 'user');
  chatHistory.push({ role: 'user', content: userText });

  // Check for actions (journal, tasks)
  const action = handleAction(userText);

  const loadingMsg = addChatMessage('Denke nach...', 'ai loading');
  const sendBtn = $('chatSendBtn');
  sendBtn.disabled = true;

  const apiKey = getApiKey();
  const context = gatherContext();

  let actionHint = '';
  if (action && action.startsWith('__task__')) {
    actionHint = `\n\nHINWEIS: Du hast gerade die Aufgabe "${action.replace('__task__', '')}" zur Aufgabenliste hinzugefuegt. Bestaetige das dem Nutzer kurz.`;
  } else if (action) {
    actionHint = `\n\nHINWEIS: Du hast gerade "${action}" ins Tagebuch eingetragen. Bestaetige das dem Nutzer kurz und freundlich.`;
  }

  const systemPrompt = `Du bist ein freundlicher, persoenlicher KI-Assistent in der App "MyDay".
Du hilfst dem Nutzer bei seinem Alltag, seinen Aufgaben und Notizen.
Antworte immer auf Deutsch, kurz und hilfreich.
Du hast Zugriff auf die Daten des Nutzers:

${context}

Du kannst fuer den Nutzer Tagebuch-Eintraege erstellen und Aufgaben hinzufuegen.
Sei ermutigend, praktisch und konkret. Gib Tipps basierend auf den echten Daten des Nutzers.${actionHint}`;

  // Build messages with chat history (last 10 messages for context)
  const historyMessages = chatHistory.slice(-10).map(m => ({
    role: m.role,
    content: m.content
  }));

  const freeModels = [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'qwen/qwen3-next-80b-a3b-instruct:free'
  ];

  let success = false;

  for (const model of freeModels) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://coding-sepp25.github.io/MyDayApp/',
          'X-Title': 'MyDay App'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMessages
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (text) {
        loadingMsg.textContent = text;
        loadingMsg.classList.remove('loading');
        chatHistory.push({ role: 'assistant', content: text });
        success = true;
        break;
      }
    } catch (err) {
      continue;
    }
  }

  if (!success) {
    const fallbackMsg = action
      ? (action.startsWith('__task__')
        ? `Aufgabe "${action.replace('__task__', '')}" hinzugefuegt!`
        : `"${action}" ins Tagebuch eingetragen!`)
      : 'Die KI ist gerade ueberlastet. Versuch es in ein paar Sekunden nochmal.';
    loadingMsg.textContent = fallbackMsg;
    loadingMsg.classList.remove('loading');
  }

  sendBtn.disabled = false;
}

$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

// ===== MODAL CLOSE ON OVERLAY =====
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
});

// ===== INIT =====
updateDates();
renderTodos();
renderTodayEntries();
requestNotificationPermission();
scheduleAllReminders();

// Update time every minute
setInterval(() => {
  $('journalTime').textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}, 60000);
