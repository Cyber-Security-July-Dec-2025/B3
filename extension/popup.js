// popup.js

const el = (id) => document.getElementById(id);
const lockedView = el('lockedView');
const vaultView = el('vaultView');
const lockBtn = el('lockBtn');

function showLocked() {
  lockedView.classList.remove('hidden');
  vaultView.classList.add('hidden');
}

function showVault() {
  lockedView.classList.add('hidden');
  vaultView.classList.remove('hidden');
  refreshList();
}

async function status() {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'STATUS' });
    if (r && r.unlocked) showVault(); else showLocked();
  } catch (_) { showLocked(); }
}

async function unlock() {
  const password = el('masterInput').value;
  const btn = el('unlockBtn');
  btn.disabled = true;
  const r = await chrome.runtime.sendMessage({ type: 'UNLOCK', password });
  btn.disabled = false;
  if (!r || !r.ok) {
    el('unlockError').textContent = (r && r.error) || 'Failed to unlock';
    return;
  }
  el('unlockError').textContent = '';
  el('masterInput').value = '';
  showVault();
}

async function refreshList() {
  try {
    const q = (el('search').value || '').toLowerCase();
    const r = await chrome.runtime.sendMessage({ type: 'LIST_CREDENTIALS' });
    const list = el('list');
    list.innerHTML = '';
    if (!r || !r.ok) return;
    for (const c of r.creds) {
      if (q && !(c.username?.toLowerCase().includes(q) || (c.origins||[]).join(',').toLowerCase().includes(q))) continue;
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.innerHTML = `<div>${escapeHtml(c.username || '(no username)')} <span class="small">${escapeHtml((c.origins||[])[0]||'')}</span></div>`;
      const right = document.createElement('div');
      const copy = document.createElement('button');
      copy.textContent = 'Copy';
      copy.title = 'Copy password';
      copy.className = 'btn';
      copy.addEventListener('click', () => navigator.clipboard.writeText(c.password||''));
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.className = 'btn';
      del.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'DELETE_CREDENTIAL', id: c.id });
        refreshList();
      });
      const edit = document.createElement('button');
      edit.textContent = 'Edit';
      edit.className = 'btn';
      edit.addEventListener('click', () => openEditDialog(c));
      right.append(edit, copy, del);
      li.append(left, right);
      list.appendChild(li);
    }
  } catch (_) {}
}

async function saveCredential() {
  let origins = el('inOrigins').value.split(',').map(s => s.trim()).filter(Boolean);
  const username = el('inUser').value;
  const password = el('inPass').value;
  const notes = el('inNotes').value;
  if (!password) return alert('Password is required');
  if (origins.length === 0) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tabs && tabs[0] && tabs[0].url;
      if (url && /^https?:/i.test(url)) {
        origins = [new URL(url).origin];
      }
    } catch (_) {}
  }
  const credential = {
    id: crypto.randomUUID(),
    origins,
    username,
    password,
    notes
  };
  const r = await chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIAL', credential });
  if (r && r.ok) {
    el('inOrigins').value = '';
    el('inUser').value = '';
    el('inPass').value = '';
    el('inNotes').value = '';
    refreshList();
  } else {
    alert('Failed to save: ' + (r?.error||''));
  }
}

async function genPassword() {
  const r = await chrome.runtime.sendMessage({ type: 'GENERATE_PASSWORD', options: { length: 20 } });
  if (r && r.ok) el('inPass').value = r.password;
}

function wire() {
  el('unlockBtn').addEventListener('click', unlock);
  el('masterInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
  el('search').addEventListener('input', refreshList);
  el('saveBtn').addEventListener('click', saveCredential);
  el('genBtn').addEventListener('click', genPassword);
  el('addToggle').addEventListener('click', () => {
    const d = document.getElementById('addPanel');
    d.open = !d.open;
  });
  lockBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'LOCK' });
    showLocked();
  });

  // edit dialog wiring
  const dlg = document.getElementById('editDialog');
  const editGen = document.getElementById('editGen');
  const editSave = document.getElementById('editSave');
  const editCancel = document.getElementById('editCancel');
  editGen.addEventListener('click', async () => {
    const r = await chrome.runtime.sendMessage({ type: 'GENERATE_PASSWORD', options: { length: 20 } });
    if (r && r.ok) el('editPass').value = r.password;
  });
  editCancel.addEventListener('click', () => dlg.close());
  editSave.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = el('editId').value;
    const origins = el('editOrigins').value.split(',').map(s => s.trim()).filter(Boolean);
    const username = el('editUser').value;
    const password = el('editPass').value;
    const notes = el('editNotes').value;
    if (!id) return;
    const credential = { id, origins, username, password, notes };
    const r = await chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIAL', credential });
    if (r && r.ok) {
      dlg.close();
      refreshList();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => { wire(); status(); });

function openEditDialog(cred) {
  el('editId').value = cred.id;
  el('editOrigins').value = (cred.origins || []).join(', ');
  el('editUser').value = cred.username || '';
  el('editPass').value = cred.password || '';
  el('editNotes').value = cred.notes || '';
  const dlg = document.getElementById('editDialog');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.show();
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch])); }
