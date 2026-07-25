import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

function resolveSecret(): string {
  const secret =
    process.env.INTEGRATIONS_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'INTEGRATIONS_SECRET or JWT_SECRET is required to encrypt secrets',
    );
  }
  return secret;
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Output format: base64(iv || authTag || ciphertext)
 */
export function encryptSecret(plaintext: string, secretMaterial?: string): string {
  const key = deriveKey(secretMaterial ?? resolveSecret());
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a value produced by encryptSecret.
 */
export function decryptSecret(payload: string, secretMaterial?: string): string {
  const key = deriveKey(secretMaterial ?? resolveSecret());
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
