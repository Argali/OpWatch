/**
 * Password hashing via Web Crypto API (PBKDF2).
 * Workers-native — no Node.js dependency, no CPU limit issues.
 * Format: base64(salt) + "." + base64(hash)
 */

const ITERATIONS = 100_000;
const KEY_LEN    = 256;
const HASH_ALG   = "SHA-256";

function encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function decode(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function importKey(password) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
}

export async function hashPassword(password) {
  const salt      = crypto.getRandomValues(new Uint8Array(16));
  const keyMat    = await importKey(password);
  const bits      = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: HASH_ALG, salt, iterations: ITERATIONS },
    keyMat,
    KEY_LEN
  );
  return `${encode(salt)}.${encode(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;
  const salt   = decode(saltB64);
  const keyMat = await importKey(password);
  const bits   = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: HASH_ALG, salt, iterations: ITERATIONS },
    keyMat,
    KEY_LEN
  );
  return encode(bits) === hashB64;
}
