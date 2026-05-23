import { LandingStatus, LeadType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateLandingPageDto {
  @IsEnum(LeadType)
  lead_type!: LeadType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  web_link?: string;

  @IsOptional()
  @IsEnum(LandingStatus)
  status?: LandingStatus;

  /** Maps incoming form field names → canonical lead fields. */
  @IsOptional()
  @IsObject()
  field_map?: Record<string, unknown>;

  /** Per-page HMAC secret. Auto-generated when omitted. */
  @IsOptional()
  @IsString()
  @MinLength(16)
  intake_secret?: string;
}
