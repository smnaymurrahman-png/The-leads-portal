import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Strongly-typed view of `process.env`. Every variable the API depends on is
 * declared here and validated at boot — if anything is missing or malformed
 * the process exits immediately instead of failing later at runtime.
 *
 *   JWT_SECRET            — auth
 *   INTAKE_HMAC_SECRET    — signed lead-intake webhook
 *   UPLOAD_*              — payment-proof + invoice file storage (Railway volume)
 *   ENCRYPTION_KEY        — at-rest encryption for stored API keys
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  /** Public origin of the Next.js web app — used for the CORS allow-list. */
  @IsUrl({ require_tld: false })
  FRONTEND_URL: string = 'http://localhost:3000';

  /** Public origin of this API — used for absolute links in invoices. */
  @IsUrl({ require_tld: false })
  BACKEND_URL: string = 'http://localhost:4000';

  /** PostgreSQL connection string (Railway). */
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  /** Signing secret for the JWT access tokens. */
  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  /** Access-token lifetime — accepts a `ms`-style string ("15m", "1d") or seconds. */
  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '1d';

  /** Shared secret for verifying HMAC-signed lead-intake requests. */
  @IsString()
  @IsNotEmpty()
  INTAKE_HMAC_SECRET!: string;

  /** Secret used to encrypt stored API keys at rest (AES-256-GCM). */
  @IsString()
  @IsNotEmpty()
  ENCRYPTION_KEY!: string;

  /** Lead deduplication window in days — phone/email reuse within this is a dup. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  LEAD_DEDUP_WINDOW_DAYS: number = 30;

  // ── File storage (Railway persistent volume) ──────────────────────────────

  /**
   * Filesystem root for uploaded files — payment-proof screenshots and
   * generated invoice PDFs. Must be writable. In production, mount the
   * Railway volume at this path.
   *   Railway: /var/lib/leads-portal/uploads
   *   Local:   ./apps/api/uploads (gitignored)
   */
  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR: string = './uploads';

  /** Max payment-proof file size in MB. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  UPLOAD_MAX_MB: number = 10;

  /**
   * HMAC secret for signing the short-lived URL tokens that protect
   * `GET /api/orders/:id/payment-proof` and `GET /api/invoices/:id/pdf`.
   * Generate with `openssl rand -base64 32`.
   */
  @IsString()
  @IsNotEmpty()
  UPLOAD_SIGNING_SECRET!: string;

  /** Validity window (seconds) for the upload-fetch signed URLs. Default 10 min. */
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(86_400)
  UPLOAD_TOKEN_TTL_SECONDS: number = 600;
}

/**
 * ConfigModule `validate` hook. Throws (and aborts startup) on the first
 * invalid environment configuration.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return validated;
}
