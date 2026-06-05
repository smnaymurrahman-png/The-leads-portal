import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Per-field encryption for sensitive PII (SSN, routing #, account #, …).
 *
 * Algorithm: AES-256-GCM with a 12-byte random IV per value. The 16-byte
 * authentication tag is appended; tampering with the ciphertext is detected
 * on decrypt and throws.
 *
 * Serialised value: `enc:v1:<iv_b64>:<tag_b64>:<ct_b64>` (a single string so
 * it stores cleanly inside the existing `Lead.qualification` JSON).
 *
 * Key: derived from `ENCRYPTION_KEY` env var (any string). We SHA-256 it to
 * get exactly 32 bytes — accepts both base64 and free-form secrets.
 */

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const ALG = 'aes-256-gcm';

/** Sentinel mime/string that identifies an already-encrypted field. */
export function isEncryptedField(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function deriveKey(rawKey: string): Buffer {
  if (!rawKey || rawKey.length < 16) {
    throw new Error('ENCRYPTION_KEY is missing or too short');
  }
  return createHash('sha256').update(rawKey, 'utf8').digest();
}

/** Encrypts a plaintext value. Returns the serialised `enc:v1:…` string. */
export function encryptField(plaintext: string, rawKey: string): string {
  if (plaintext === '' || plaintext == null) {
    return plaintext;
  }
  const key = deriveKey(rawKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** Returns plaintext. Throws on tampered/invalid ciphertext. */
export function decryptField(encoded: string, rawKey: string): string {
  if (!isEncryptedField(encoded)) {
    // Backwards-compat: a plaintext value sitting where an encrypted one
    // should be (e.g. legacy data) is returned as-is.
    return encoded;
  }
  const [ivB64, tagB64, ctB64] = encoded.slice(PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed encrypted field');
  }
  const key = deriveKey(rawKey);
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}

// ── Masking ───────────────────────────────────────────────────────────────────

/**
 * Display-time masking for sensitive plaintext.
 *
 *   ssn      "123-45-6789" → "•••-••-6789"
 *   account  "1234567890"  → "••••••7890"
 *   routing  any            → "•••••••••"   (routing numbers are not useful partial)
 *   dl       any            → "••••••••"
 *   last4    any            → last 4 chars  (generic)
 *   full     any            → "••••••"      (fully redacted)
 */
export type MaskKind = 'ssn' | 'account' | 'routing' | 'dl' | 'last4' | 'full';

export function maskValue(plain: string | null | undefined, kind: MaskKind | string | null | undefined): string {
  if (plain == null || plain === '') {
    return '';
  }
  const trimmed = plain.replace(/\s+/g, '');
  switch (kind) {
    case 'ssn': {
      const digits = trimmed.replace(/\D/g, '');
      const tail = digits.slice(-4).padStart(4, '•');
      return `•••-••-${tail}`;
    }
    case 'account':
    case 'last4': {
      const tail = trimmed.slice(-4);
      return `${'•'.repeat(Math.max(0, trimmed.length - 4))}${tail}`;
    }
    case 'routing':
      return '•'.repeat(Math.max(8, trimmed.length));
    case 'dl':
      return '•'.repeat(Math.max(6, trimmed.length));
    case 'full':
    default:
      return '•'.repeat(Math.max(6, trimmed.length));
  }
}

/**
 * Constant-time string comparison helper. Use to compare a user-supplied
 * value with a stored one without timing leaks.
 */
export function safeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
