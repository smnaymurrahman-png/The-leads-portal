import { LandingStatus, LeadType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

/** Editable fields of a landing page. */
export class UpdateLandingPageDto {
  @IsOptional()
  @IsEnum(LeadType)
  lead_type?: LeadType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  web_link?: string;

  @IsOptional()
  @IsEnum(LandingStatus)
  status?: LandingStatus;

  @IsOptional()
  @IsObject()
  field_map?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MinLength(16)
  intake_secret?: string;
}
