// scripts/generator.js
// Secure password generator using crypto.getRandomValues

function pick(chars, n, rnd) {
  let out = '';
  if (!chars || chars.length === 0 || n <= 0) return out;
  for (let i = 0; i < n; i++) out += chars[rnd() % chars.length];
  return out;
}

function shuffle(str, rnd) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd() % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

export function generatePassword(options = {}) {
  const length = Math.max(8, Math.min(128, options.length || 16));
  // Always include all character classes by default
  const useLower = options.lower !== false; // default true
  const useUpper = options.upper !== false; // default true
  const useDigits = options.digits !== false; // default true
  const useSymbols = options.symbols !== false; // default true, unless explicitly disabled

  const lowers = 'abcdefghijklmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  // Build the symbols set from all printable ASCII (33-126) excluding alphanumerics
  // This captures a comprehensive set of special ASCII symbols.
  let symbols = '';
  for (let code = 33; code <= 126; code++) {
    const ch = String.fromCharCode(code);
    if ((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) continue;
    symbols += ch;
  }

  let pool = '';
  if (useLower) pool += lowers;
  if (useUpper) pool += uppers;
  if (useDigits) pool += digits;
  if (useSymbols) pool += symbols;
  if (!pool) pool = lowers + uppers + digits + symbols;

  // cryptographically secure random index function
  const rnd = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  };

  // Ensure at least one of each selected class
  let base = '';
  if (useLower) base += pick(lowers, 1, rnd);
  if (useUpper) base += pick(uppers, 1, rnd);
  if (useDigits) base += pick(digits, 1, rnd);
  if (useSymbols) base += pick(symbols, 1, rnd);

  let rest = '';
  for (let i = base.length; i < length; i++) rest += pool[rnd() % pool.length];

  let pwd = shuffle(base + rest, rnd);

  // Verify and patch: ensure at least one of each selected class exists
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSymbol = /[^0-9A-Za-z]/.test(pwd);

  // Helper to replace a random position with a char from set
  const replaceWith = (set) => {
    const pos = rnd() % pwd.length;
    const ch = set[rnd() % set.length];
    pwd = pwd.substring(0, pos) + ch + pwd.substring(pos + 1);
  };

  if (useLower && !hasLower) replaceWith(lowers);
  if (useUpper && !hasUpper) replaceWith(uppers);
  if (useDigits && !hasDigit) replaceWith(digits);
  if (useSymbols && !hasSymbol) replaceWith(symbols);

  return pwd;
}
