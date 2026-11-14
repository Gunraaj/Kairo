/**
 * End-to-end encryption for cloud sync. The server only ever stores this envelope.
 * Key = PBKDF2-SHA256(passphrase, random salt, 600k iterations) -> AES-256-GCM, fresh 96-bit IV per save.
 * A lost passphrase means the cloud copy cannot be recovered (local data is unaffected).
 */

export const DEFAULT_ITERATIONS = 600_000;

export type VaultEnvelope = {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export class VaultError extends Error {}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
};
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), c => c.charCodeAt(0));

const deriveKey = async (passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const encryptVault = async (plaintext: string, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<VaultEnvelope> => {
  if (passphrase.length < 8) throw new VaultError('Use a passphrase of at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext));
  return { v: 1, iter: iterations, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(data)) };
};

export const decryptVault = async (envelope: VaultEnvelope, passphrase: string): Promise<string> => {
  if (!envelope || envelope.v !== 1 || !Number.isInteger(envelope.iter) || envelope.iter < 1_000 || envelope.iter > 10_000_000) {
    throw new VaultError('Unsupported or damaged backup.');
  }
  try {
    const key = await deriveKey(passphrase, fromBase64(envelope.salt), envelope.iter);
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) as BufferSource }, key, fromBase64(envelope.ciphertext) as BufferSource);
    return new TextDecoder().decode(data);
  } catch {
    throw new VaultError('Wrong passphrase, or the backup is damaged.');
  }
};
