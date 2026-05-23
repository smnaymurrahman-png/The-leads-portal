import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Consent captured by the WordPress form at submission time. */
export class ConsentDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  ip?: string;
}

/**
 * Body of `POST /intake/:landingPageId/lead`.
 *
 * `data` holds the raw form fields keyed by the WordPress field names; the
 * landing page's `field_map` maps them onto the canonical lead columns.
 * Phone / email format is checked in the pipeline, not here, so a badly
 * formatted lead is still recorded (as REJECTED) rather than 400'd away.
 */
export class IntakeLeadDto {
  /** Idempotency key from the WordPress submission. */
  @IsString()
  @MinLength(1)
  submission_id!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  source_url?: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConsentDto)
  consent?: ConsentDto;
}
