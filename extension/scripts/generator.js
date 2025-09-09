// scripts/generator.js
// Secure password generator using crypto.getRandomValues

function pick(chars, n, rnd) {
  let out = '';
  for (let i = 0; i < n; i++) out += chars[rnd()];
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
  // Wide symbol set (commonly allowed). Excludes space.
  const symbols = "!\"#$%&'()*+,-./:;<=>?@[]^_`{|}~\\"; // includes backslash and quotes

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

  return shuffle(base + rest, rnd);
}
