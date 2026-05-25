import { CampaignAdsType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

/** Editable fields of a campaign. Created-by/at are immutable. */
export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(CampaignAdsType)
  ads_type?: CampaignAdsType;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  production_link?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  day_count?: number;

  @IsOptional()
  @IsObject()
  results?: Record<string, unknown>;
}
