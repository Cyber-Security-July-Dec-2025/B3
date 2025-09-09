// background.js (service worker) - MV3
// Maintains vault state, handles crypto, storage, messaging, and auto-lock

import { deriveKeyPBKDF2, encryptJSON, decryptJSON, bytesToBase64, base64ToBytes } from './scripts/crypto.js';
import { idbGet, idbSet, ensureDB } from './scripts/storage.js';
import { generatePassword } from './scripts/generator.js';

const VAULT_STORE = 'vault';
const VAULT_KEY = 'default';
const META_KEY = 'meta';

let derivedKey = null; // CryptoKey when unlocked
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
  unlockedAt = Date.now();
  chrome.alarms.clear('autolock');
  chrome.alarms.create('autolock', { when: Date.now() + autolockMs });
}

async function lockVault() {
  derivedKey = null;
  unlockedAt = 0;
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
  if (!derivedKey) throw new Error('Vault is locked');
  return decryptJSON(enc, derivedKey);
}

async function setVaultJson(json) {
  if (!derivedKey) throw new Error('Vault is locked');
  const enc = await encryptJSON(json, derivedKey);
  await idbSet(VAULT_STORE, VAULT_KEY, enc);
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInit();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autolock') {
    if (derivedKey && Date.now() - unlockedAt >= autolockMs - 1000) {
      lockVault();
    } else if (derivedKey) {
      resetAutolockTimer();
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'STATUS') {
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
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'LOCK') {
        await lockVault();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === 'GET_CREDENTIALS_FOR_ORIGIN') {
        if (!derivedKey) throw new Error('Locked');
        resetAutolockTimer();
        const { origin } = msg;
        const vault = await getVaultJson();
        const list = vault.creds.filter((c) => c.origins?.includes(origin));
        sendResponse({ ok: true, creds: list });
        return;
      }
      if (msg.type === 'SAVE_CREDENTIAL') {
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
        if (!derivedKey) throw new Error('Locked');
        resetAutolockTimer();
        const vault = await getVaultJson();
        sendResponse({ ok: true, creds: vault.creds });
        return;
      }
      if (msg.type === 'DELETE_CREDENTIAL') {
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
        const { ms } = msg;
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
      console.error(e);
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true; // keep channel open for async
});
