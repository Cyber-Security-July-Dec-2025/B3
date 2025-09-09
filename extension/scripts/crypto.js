// scripts/crypto.js
// PBKDF2 key derivation and AES-GCM encryption helpers

export async function deriveKeyPBKDF2(password, salt, iterations = 310000) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can export to chrome.storage.session for MV3 service worker resume
    ['encrypt', 'decrypt']
  );
}

export function bytesToBase64(bytes) {
  let bin = '';
  bytes = new Uint8Array(bytes);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptJSON(obj, key, randomIfNoKey = false) {
  if (!key && randomIfNoKey) {
    // generate ephemeral key to initialize blank vault
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    v: 1,
    alg: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ct)),
  };
}

export async function decryptJSON(payload, key) {
  if (!payload) throw new Error('No payload');
  const iv = base64ToBytes(payload.iv);
  const ct = base64ToBytes(payload.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(pt));
}
