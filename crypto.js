// Password lock for the GitHub key.
// The key (a fine-grained GitHub token that can only edit this one repo) is
// encrypted with Nubia's password and stored in lock.json. The browser
// decrypts it when she types the right password; the password itself is
// never stored anywhere.
(function () {
  const ITER = 600000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function deriveKey(password, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function lockSecret(secret, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, ITER);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
    return { setup: true, v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }

  // Throws if the password is wrong (AES-GCM refuses to decrypt).
  async function unlockSecret(lock, password) {
    const key = await deriveKey(password, unb64(lock.salt), lock.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(lock.iv) }, key, unb64(lock.ct));
    return dec.decode(pt);
  }

  window.Lock = { lockSecret, unlockSecret };
})();
