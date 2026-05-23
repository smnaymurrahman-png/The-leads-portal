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
 * The JWT / Stripe / HMAC secrets are declared now (Phase 0 scaffold) and
 * consumed by later phases:
 *   JWT_SECRET            — Phase 2 (auth)
 *   INTAKE_HMAC_SECRET    — Phase 3 (signed lead-intake webhook)
 *   STRIPE_*              — Phase 4 (payments)
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

  /** Public origin of this API — used for absolute links and webhook URLs. */
  @IsUrl({ require_tld: false })
  BACKEND_URL: string = 'http://localhost:4000';

  /** PostgreSQL connection string (Railway). */
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  /** Signing secret for the JWT access tokens issued in Phase 2. */
  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  /** Access-token lifetime — accepts a `ms`-style string ("15m", "1d") or seconds. */
  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '1d';

  /** Stripe secret API key (Phase 4). */
  @IsString()
  @IsNotEmpty()
  STRIPE_SECRET_KEY!: string;

  /** Stripe webhook signing secret (Phase 4). */
  @IsString()
  @IsNotEmpty()
  STRIPE_WEBHOOK_SECRET!: string;

  /** Shared secret for verifying HMAC-signed lead-intake requests (Phase 3). */
  @IsString()
  @IsNotEmpty()
  INTAKE_HMAC_SECRET!: string;

  /** Secret used to encrypt stored API keys at rest (AES-256-GCM, Phase 10). */
  @IsString()
  @IsNotEmpty()
  ENCRYPTION_KEY!: string;

  /** Lead deduplication window in days — phone/email reuse within this is a dup. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  LEAD_DEDUP_WINDOW_DAYS: number = 30;
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
