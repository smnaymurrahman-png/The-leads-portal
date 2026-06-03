import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { signResource, verifyResource } from './signed-url.util';

/** Whitelisted MIME types for the payment-proof upload. */
const PAYMENT_PROOF_MIME_WHITELIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/** Map of accepted MIME → file extension used when persisting the upload. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface StoredFile {
  /** Path relative to `UPLOAD_DIR` (DB-safe). */
  relativePath: string;
  filename: string;
  size: number;
  mime: string;
  sha256: string;
}

export interface UploadOptions {
  /** Logical subtree under `UPLOAD_DIR` — e.g. "payment-proofs", "invoices". */
  bucket: string;
  /** Provided by the client; recorded for the audit trail. */
  originalFilename: string;
  mime: string;
  buffer: Buffer;
  /** Override the default whitelist (defaults to the payment-proof set). */
  allowedMimes?: ReadonlySet<string>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly maxBytes: number;
  private readonly signingSecret: string;
  private readonly tokenTtlSeconds: number;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    this.root = resolve(this.config.get('UPLOAD_DIR', { infer: true }));
    this.maxBytes = this.config.get('UPLOAD_MAX_MB', { infer: true }) * 1024 * 1024;
    this.signingSecret = this.config.get('UPLOAD_SIGNING_SECRET', { infer: true });
    this.tokenTtlSeconds = this.config.get('UPLOAD_TOKEN_TTL_SECONDS', { infer: true });
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Persists `opts.buffer` under `bucket/YYYY-MM/randomhex.ext`. Validates
   * size + MIME and computes a sha256 for the row. Returns paths/metadata
   * for the caller to persist on the Order / Invoice row.
   */
  async store(opts: UploadOptions): Promise<StoredFile> {
    if (!opts.buffer || opts.buffer.length === 0) {
      throw new BadRequestException('Empty upload');
    }
    if (opts.buffer.length > this.maxBytes) {
      throw new BadRequestException(
        `File too large (${opts.buffer.length} bytes, max ${this.maxBytes})`,
      );
    }
    const allowed = opts.allowedMimes ?? PAYMENT_PROOF_MIME_WHITELIST;
    const mime = opts.mime.toLowerCase();
    if (!allowed.has(mime)) {
      throw new BadRequestException(
        `Unsupported file type ${mime}. Allowed: ${[...allowed].join(', ')}`,
      );
    }

    const ext = MIME_TO_EXT[mime] ?? 'bin';
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const filename = `${randomBytes(16).toString('hex')}.${ext}`;
    const relativePath = join(opts.bucket, yearMonth, filename);
    const absPath = join(this.root, relativePath);

    await fs.mkdir(join(this.root, opts.bucket, yearMonth), { recursive: true });
    await fs.writeFile(absPath, opts.buffer);

    const sha256 = createHash('sha256').update(opts.buffer).digest('hex');

    this.logger.log(
      `Stored ${opts.bucket} file: ${relativePath} (${opts.buffer.length} bytes, sha256 ${sha256.slice(0, 8)}…)`,
    );

    return {
      relativePath,
      filename: opts.originalFilename,
      size: opts.buffer.length,
      mime,
      sha256,
    };
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /** Returns the absolute filesystem path for a stored relative path. */
  absolutePath(relativePath: string): string {
    const abs = resolve(this.root, relativePath);
    // Guard against any `..` escape in DB-stored paths.
    if (!abs.startsWith(this.root)) {
      throw new BadRequestException('Invalid storage path');
    }
    return abs;
  }

  /** Reads a stored file. Throws 404 if missing. */
  async read(relativePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.absolutePath(relativePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  /** Best-effort delete — used when an order is replaced or wiped. */
  async remove(relativePath: string): Promise<void> {
    try {
      await fs.unlink(this.absolutePath(relativePath));
    } catch {
      // ignore — already gone is fine
    }
  }

  // ── Signed URLs ────────────────────────────────────────────────────────────

  /**
   * Returns a token that lets the bearer fetch `resourceId` for the next
   * `UPLOAD_TOKEN_TTL_SECONDS`. Intent prevents a payment-proof token from
   * being replayed to fetch an invoice (or vice versa).
   */
  signResourceUrl(intent: string, resourceId: string, principalId: string): {
    token: string;
    expSeconds: number;
  } {
    const expSeconds = Math.floor(Date.now() / 1000) + this.tokenTtlSeconds;
    return {
      token: signResource({ intent, resourceId, principalId, expSeconds }, this.signingSecret),
      expSeconds,
    };
  }

  verifyResourceUrl(
    token: string | undefined,
    intent: string,
    resourceId: string,
  ): { principalId: string } | null {
    const claims = verifyResource(token, intent, resourceId, this.signingSecret);
    return claims ? { principalId: claims.principalId } : null;
  }
}
