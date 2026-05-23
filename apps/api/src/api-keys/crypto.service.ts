import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
/** Fixed KDF salt — `ENCRYPTION_KEY` is the secret; this only domain-separates. */
const KDF_SALT = 'leads-portal-encryption-kdf';

/**
 * AES-256-GCM encryption for secrets stored at rest (e.g. `api_keys`).
 * The 32-byte key is derived from `ENCRYPTION_KEY` via scrypt, so any
 * sufficiently strong env string works.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.key = scryptSync(config.get('ENCRYPTION_KEY', { infer: true }), KDF_SALT, 32);
  }

  /** Returns `iv:authTag:ciphertext`, all base64. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const [ivB64, tagB64, dataB64] = stored.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed ciphertext');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
