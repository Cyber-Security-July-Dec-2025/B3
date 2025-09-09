// content.js - detects login forms and autofills credentials when available

(function () {
  const origin = location.origin;

  function findLoginForm() {
    const pw = document.querySelector('input[type="password"]');
    if (!pw) return null;
    // Try to find username field near password
    const form = pw.closest('form') || document;
    const candidates = form.querySelectorAll('input');
    let user = null;
    for (const el of candidates) {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      const nm = (el.getAttribute('name') || '').toLowerCase();
      if (t === 'text' || t === 'email' || t === 'username') {
        user = el; break;
      }
      if (nm.includes('user') || nm.includes('email') || nm.includes('login')) user = el;
    }
    return { form: form === document ? null : form, user, pw };
  }

  async function tryAutofill() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS_FOR_ORIGIN', origin });
      if (!resp || !resp.ok) return;
      const { creds } = resp;
      if (!creds || creds.length === 0) return;
      const { user, pw } = findLoginForm() || {};
      if (!pw) return;
      const cred = creds[0];
      if (user && cred.username) user.value = cred.username;
      pw.value = cred.password || '';
    } catch (e) {
      // ignored
    }
  }

  function ensureSaveHook() {
    const lf = findLoginForm();
    if (!lf || !lf.form) return;
    const { form, user, pw } = lf;
    if (!form.__passvault_hooked) {
      form.__passvault_hooked = true;
      form.addEventListener('submit', async (ev) => {
        try {
          const username = user ? user.value : '';
          const password = pw ? pw.value : '';
          if (!password) return; // don't save empty
          const shouldSave = confirm('Save credentials to PassVault?');
          if (!shouldSave) return;
          const id = crypto.randomUUID();
          const credential = { id, origins: [origin], origin, username, password, notes: '' };
          await chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIAL', credential });
        } catch (_) {}
      }, { capture: true });
    }
  }

  const observer = new MutationObserver(() => {
    tryAutofill();
    ensureSaveHook();
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });
  document.addEventListener('DOMContentLoaded', () => { tryAutofill(); ensureSaveHook(); });
  tryAutofill();
  ensureSaveHook();
})();
