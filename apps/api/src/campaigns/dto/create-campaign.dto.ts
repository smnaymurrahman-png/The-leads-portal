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

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(CampaignAdsType)
  ads_type!: CampaignAdsType;

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

  /** Free-form results blob (impressions, CPL, ...). */
  @IsOptional()
  @IsObject()
  results?: Record<string, unknown>;
}
