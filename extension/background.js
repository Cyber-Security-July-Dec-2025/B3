// background.js (service worker) - MV3
// Maintains vault state, handles crypto, storage, messaging, and auto-lock

import { deriveKeyPBKDF2, encryptJSON, decryptJSON, bytesToBase64, base64ToBytes } from './scripts/crypto.js';
import { idbGet, idbSet, ensureDB } from './scripts/storage.js';
import { generatePassword } from './scripts/generator.js';

// Minimal logging gate to avoid console noise in production (e.g., Chrome Web Store)
const DEBUG = false;
function logDebug(...args){ if (DEBUG) console.debug('[PassVault]', ...args); }
function logWarn(...args){ if (DEBUG) console.warn('[PassVault]', ...args); }
function logError(...args){ if (DEBUG) console.error('[PassVault]', ...args); }

const VAULT_STORE = 'vault';
const VAULT_KEY = 'default';
const META_KEY = 'meta';

let derivedKey = null; // CryptoKey when unlocked (restored from chrome.storage.session if service worker is restarted)
let unlockedAt = 0;
let autolockMs = 5 * 60 * 1000; // default 5 minutes

async function loadMeta() {
  const meta = await chrome.storage.local.get([META_KEY]);
  return meta[META_KEY] || null;
}

async function saveMeta(meta) {
  await chrome.storage.local.set({ [META_KEY]: meta });
}

function resetAutolockTimer() {
  try {
    unlockedAt = Date.now();
    const minutes = Math.max(1, Math.round((autolockMs || 5 * 60 * 1000) / 60000));
    chrome.alarms.clear('autolock', () => {
      chrome.alarms.create('autolock', { delayInMinutes: minutes });
    });
  } catch (e) {
    logWarn('Failed to set autolock alarm', e);
  }
}

async function lockVault() {
  derivedKey = null;
  unlockedAt = 0;
  try { await chrome.storage.session.remove('unlockedKeyJwk'); } catch (_) {}
}

async function ensureInit() {
  await ensureDB();
  let meta = await loadMeta();
  if (!meta) {
    meta = {
      kdf: 'PBKDF2',
      iterations: 310000,
      saltB64: bytesToBase64(crypto.getRandomValues(new Uint8Array(16))),
      autolockMs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveMeta(meta);
    // Do not initialize the vault yet. It will be created on first successful unlock/save
  } else {
    autolockMs = meta.autolockMs || autolockMs;
  }
}

async function deriveKeyFromMeta(password) {
  const meta = await loadMeta();
  if (!meta) throw new Error('Meta not initialized');
  const salt = base64ToBytes(meta.saltB64);
  return deriveKeyPBKDF2(password, salt, meta.iterations);
}

async function getVaultJson() {
  const enc = await idbGet(VAULT_STORE, VAULT_KEY);
  if (!enc) return { creds: [] };
  if (!derivedKey) await tryRestoreKeyFromSession();
  if (!derivedKey) throw new Error('Vault is locked');
  return decryptJSON(enc, derivedKey);
}

async function setVaultJson(json) {
  if (!derivedKey) await tryRestoreKeyFromSession();
  if (!derivedKey) throw new Error('Vault is locked');
  const enc = await encryptJSON(json, derivedKey);
  await idbSet(VAULT_STORE, VAULT_KEY, enc);
}

async function tryRestoreKeyFromSession() {
  try {
    const { unlockedKeyJwk } = await chrome.storage.session.get('unlockedKeyJwk');
    if (!unlockedKeyJwk) return;
    derivedKey = await crypto.subtle.importKey(
      'jwk',
      unlockedKeyJwk,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    if (derivedKey) resetAutolockTimer();
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInit();
  // Create context menu items
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: 'passvault_paste_username', title: 'PassVault: Paste username', contexts: ['editable'] });
      chrome.contextMenus.create({ id: 'passvault_paste_password', title: 'PassVault: Paste password', contexts: ['editable'] });
      chrome.contextMenus.create({ id: 'passvault_autofill', title: 'PassVault: Autofill login', contexts: ['page', 'frame', 'editable'] });
    });
  } catch (_) {}
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autolock') {
    if (derivedKey) {
      lockVault();
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'STATUS') {
        if (!derivedKey) await tryRestoreKeyFromSession();
        sendResponse({ ok: true, unlocked: !!derivedKey });
        return;
      }
      if (msg.type === 'UNLOCK') {
        const { password } = msg;
        await ensureInit();
        const key = await deriveKeyFromMeta(password);
        // Try decrypt
        const enc = await idbGet(VAULT_STORE, VAULT_KEY);
        try {
          if (enc) {
            await decryptJSON(enc, key);
          } else {
            // First-time unlock: initialize empty vault encrypted with this key
            await idbSet(VAULT_STORE, VAULT_KEY, await encryptJSON({ creds: [] }, key));
          }
        } catch (e) {
          sendResponse({ ok: false, error: 'Invalid master password' });
          return;
        }
        derivedKey = key;
        resetAutolockTimer();
        // Persist key for session resume
        try {
          const jwk = await crypto.subtle.exportKey('jwk', derivedKey);
          await chrome.storage.session.set({ unlockedKeyJwk: jwk });
        } catch (e) {
          // ignore if export not allowed
        }
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'LOCK') {
        await lockVault();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'GET_CREDENTIALS_FOR_ORIGIN') {
        if (!derivedKey) await tryRestoreKeyFromSession();
        if (!derivedKey) throw new Error('Locked');
        resetAutolockTimer();
        const { origin } = msg;
        const vault = await getVaultJson();
        const list = vault.creds.filter((c) => c.origins?.includes(origin));
        sendResponse({ ok: true, creds: list });
        return;
      }
      if (msg.type === 'SAVE_CREDENTIAL') {
        if (!derivedKey) await tryRestoreKeyFromSession();
        if (!derivedKey) throw new Error('Locked');
        resetAutolockTimer();
        const { credential } = msg; // {id, origin(s), username, password, notes}
        const vault = await getVaultJson();
        const idx = vault.creds.findIndex((c) => c.id === credential.id);
        if (idx >= 0) vault.creds[idx] = credential; else vault.creds.push(credential);
        await setVaultJson(vault);
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'LIST_CREDENTIALS') {
        if (!derivedKey) await tryRestoreKeyFromSession();
        if (!derivedKey) throw new Error('Locked');
        resetAutolockTimer();
        const vault = await getVaultJson();
        sendResponse({ ok: true, creds: vault.creds });
        return;
      }
      if (msg.type === 'DELETE_CREDENTIAL') {
        if (!derivedKey) await tryRestoreKeyFromSession();
        if (!derivedKey) throw new Error('Locked');
        resetAutolockTimer();
        const { id } = msg;
        const vault = await getVaultJson();
        const next = vault.creds.filter((c) => c.id !== id);
        await setVaultJson({ creds: next });
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'GENERATE_PASSWORD') {
        const { options } = msg;
        const pwd = generatePassword(options || {});
        sendResponse({ ok: true, password: pwd });
        return;
      }
      if (msg.type === 'SET_AUTOLOCK') {
        let { ms } = msg;
        ms = Number(ms);
        if (!Number.isFinite(ms) || ms < 60 * 1000) {
          sendResponse({ ok: false, error: 'Invalid autolock value; must be >= 1 minute' });
          return;
        }
        const meta = await loadMeta();
        meta.autolockMs = ms;
        await saveMeta(meta);
        autolockMs = ms;
        if (derivedKey) resetAutolockTimer();
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: 'Unknown message' });
    } catch (e) {
      logError('background message error', e);
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true; // keep channel open for async
});

async function getCredsForOrigin(origin) {
  if (!derivedKey) await tryRestoreKeyFromSession();
  if (!derivedKey) throw new Error('Locked');
  const vault = await getVaultJson();
  return (vault.creds || []).filter(c => (c.origins || []).includes(origin));
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const url = info?.pageUrl || tab?.url;
    if (!url || !/^https?:/i.test(url)) return;
    const origin = new URL(url).origin;
    const creds = await getCredsForOrigin(origin);
    if (!creds || creds.length === 0) return;
    const cred = creds[0]; // first match
    if (info.menuItemId === 'passvault_paste_username') {
      // paste into active element
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined, allFrames: false },
        func: (value) => {
          const el = document.activeElement;
          if (!el) return;
          const d = Object.getOwnPropertyDescriptor(el.__proto__, 'value');
          d?.set?.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        },
        args: [cred.username || '']
      });
    } else if (info.menuItemId === 'passvault_paste_password') {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: info.frameId ? [info.frameId] : undefined, allFrames: false },
        func: (value) => {
          const el = document.activeElement;
          if (!el) return;
          const d = Object.getOwnPropertyDescriptor(el.__proto__, 'value');
          d?.set?.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        },
        args: [cred.password || '']
      });
    } else if (info.menuItemId === 'passvault_autofill') {
      // delegate to content script to locate proper fields and apply both
      await chrome.tabs.sendMessage(tab.id, { type: 'APPLY_CREDENTIAL', cred, origin }, { frameId: info.frameId });
    }
  } catch (e) {
    logWarn('context menu action failed', e);
  }
});
