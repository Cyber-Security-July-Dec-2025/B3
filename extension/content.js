// content.js - robust autofill for PassVault

(function () {
  const origin = location.origin;

  function findFields() {
    // prefer visible password field
    const pwAll = Array.from(document.querySelectorAll('input[type="password"]'))
      .filter(isVisible);
    const pw = pwAll[0] || null;
    if (!pw) return null;
    const scope = pw.closest('form') || document;
    const inputs = Array.from(scope.querySelectorAll('input'));
    let user = null;
    const userHints = ['user', 'email', 'login', 'id', 'mail'];
    for (const el of inputs) {
      if (el === pw) continue;
      const t = (el.type || 'text').toLowerCase();
      const nm = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const pl = (el.placeholder || '').toLowerCase();
      if (['text', 'email', 'username'].includes(t)) user = user || el;
      if (userHints.some(h => nm.includes(h) || id.includes(h) || pl.includes(h))) user = user || el;
    }
    return { form: scope === document ? null : scope, user, pw };
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const hidden = window.getComputedStyle(el).display === 'none' || window.getComputedStyle(el).visibility === 'hidden';
    return rect.width > 0 && rect.height > 0 && !hidden;
  }

  function setValue(el, value) {
    if (!el) return;
    const native = Object.getOwnPropertyDescriptor(el.__proto__, 'value');
    native?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function fetchCreds() {
    try {
      return await chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS_FOR_ORIGIN', origin });
    } catch {
      return null;
    }
  }

  function renderPicker(creds, target) {
    // minimal floating picker using shadow DOM to avoid site styles
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    const rect = target.getBoundingClientRect();
    host.style.left = Math.max(8, rect.left + window.scrollX) + 'px';
    host.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .box { font: 12px ui-sans-serif, system-ui; color: #0a0a0a; background: #fff; border: 1px solid #e5e5e5; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      @media (prefers-color-scheme: dark){ .box { color:#e5e5e5; background:#0a0a0a; border-color:#222; } }
      .row { display:flex; align-items:center; gap:6px; padding:6px 8px; cursor:pointer; }
      .row:hover { background: rgba(0,0,0,0.05); }
      @media (prefers-color-scheme: dark){ .row:hover { background: rgba(255,255,255,0.06); } }
      .small { opacity: 0.7; }
    `;
    const box = document.createElement('div');
    box.className = 'box';
    creds.slice(0, 6).forEach(c => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>${escapeHtml(c.username || '(no username)')}</span> <span class="small">${escapeHtml((c.origins||[])[0]||'')}</span>`;
      row.addEventListener('click', () => {
        applyCred(c);
        cleanup();
      });
      box.appendChild(row);
    });
    root.append(style, box);
    function cleanup(){ host.remove(); document.removeEventListener('click', onDoc, true); }
    function onDoc(e){ if (!host.contains(e.target)) cleanup(); }
    setTimeout(() => document.addEventListener('click', onDoc, true));
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch])); }

  function applyCred(cred) {
    const fields = findFields();
    if (!fields || !fields.pw) return;
    const { user, pw } = fields;
    if (user && cred.username) setValue(user, cred.username);
    setValue(pw, cred.password || '');
  }

  async function maybeAutofill(showPicker = true) {
    const fields = findFields();
    if (!fields || !fields.pw) return;
    const resp = await fetchCreds();
    if (!resp || !resp.ok) return; // possibly locked
    const creds = resp.creds || [];
    if (creds.length === 0) return;
    if (creds.length === 1) {
      applyCred(creds[0]);
    } else if (showPicker) {
      renderPicker(creds, fields.pw);
    }
  }

  function ensureSaveHook() {
    const lf = findFields();
    if (!lf || !lf.form) return;
    const { form, user, pw } = lf;
    if (!form.__passvault_hooked) {
      form.__passvault_hooked = true;
      form.addEventListener('submit', async () => {
        try {
          const username = user ? user.value : '';
          const password = pw ? pw.value : '';
          if (!password) return; // don't save empty
          const id = crypto.randomUUID();
          const credential = { id, origins: [origin], origin, username, password, notes: '' };
          await chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIAL', credential });
        } catch (_) {}
      }, { capture: true });
    }
  }

  // triggers
  document.addEventListener('DOMContentLoaded', () => { maybeAutofill(true); ensureSaveHook(); });
  window.addEventListener('focus', () => { maybeAutofill(false); }, true);
  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches('input[type="password"]')) maybeAutofill(false);
  });
  const observer = new MutationObserver(() => { maybeAutofill(false); ensureSaveHook(); });
  observer.observe(document.documentElement, { subtree: true, childList: true });
  // initial
  maybeAutofill(true);
  ensureSaveHook();
})();
