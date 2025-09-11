// content.js - robust autofill for PassVault

(function () {
  const origin = location.origin;

  const DEBUG = false;

  function log(...args){ if (DEBUG) console.debug('[PassVault]', ...args); }

  function findFields() {
    // collect candidate password fields that are visible and not disabled
    const pwAll = Array.from(document.querySelectorAll('input[type="password" i]'))
      .filter(isVisible)
      .filter(el => !el.disabled && !el.readOnly);
    if (pwAll.length === 0) return null;

    // choose the one inside a form with a likely submit button if possible
    let pw = null;
    for (const cand of pwAll) {
      const form = cand.closest('form');
      if (form && form.querySelector('button[type="submit"], input[type="submit"], button:not([type])')) { pw = cand; break; }
    }
    pw = pw || pwAll[0];

    const scope = pw.closest('form') || document;
    const inputs = Array.from(scope.querySelectorAll('input'));
    let user = null;
    const userHints = ['user', 'email', 'login', 'id', 'mail', 'account', 'phone'];
    for (const el of inputs) {
      if (el === pw) continue;
      const t = (el.type || 'text').toLowerCase();
      const nm = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const pl = (el.placeholder || '').toLowerCase();
      const ac = (el.autocomplete || '').toLowerCase();
      if (['text', 'email', 'username'].includes(t)) user = user || el;
      if (['username', 'email'].includes(ac)) user = user || el;
      if (userHints.some(h => nm.includes(h) || id.includes(h) || pl.includes(h))) user = user || el;
    }
    log('findFields ->', { pw, user, scope });
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

  // Track when the user manually edits inputs so we do not overwrite their changes
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t && t.tagName === 'INPUT') {
      t.dataset.passvaultEdited = '1';
    }
  }, true);

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
    if (user && cred.username) {
      setValue(user, cred.username);
      user.dataset.passvaultApplied = '1';
    }
    setValue(pw, cred.password || '');
    pw.dataset.passvaultApplied = '1';
  }

  async function maybeAutofill(showPicker = true) {
    const fields = findFields();
    if (!fields || !fields.pw) return;
    // Respect user edits: do not autofill once user started typing
    if ((fields.user && fields.user.dataset.passvaultEdited === '1') || (fields.pw && fields.pw.dataset.passvaultEdited === '1')) {
      log('skip autofill due to user edits');
      return;
    }
    // Avoid repeatedly reapplying if we've already applied once and the field has a value
    if (fields.pw && fields.pw.dataset.passvaultApplied === '1' && fields.pw.value) {
      log('skip autofill; already applied');
      return;
    }
    const resp = await fetchCreds();
    if (!resp || !resp.ok) return; // possibly locked
    const creds = resp.creds || [];
    if (creds.length === 0) return;
    if (creds.length === 1) {
      log('autofill with single cred');
      applyCred(creds[0]);
    } else if (showPicker) {
      log('show picker with', creds.length, 'creds');
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
          // Ask user before saving
          const host = (() => { try { return new URL(location.href).host; } catch (_) { return location.host || origin; } })();
          const ok = window.confirm(`Save password for ${host}?`);
          if (!ok) return; // user declined
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

  // respond to background requests to apply a specific credential
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'APPLY_CREDENTIAL' && msg.cred) {
      applyCred(msg.cred);
      sendResponse({ ok: true });
    }
  });
})();
