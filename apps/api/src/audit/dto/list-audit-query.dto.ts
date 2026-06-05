import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Filters for the audit viewer. */
export class ListAuditQueryDto {
  @IsOptional()
  @IsString()
  entity?: string;

  /**
   * Single action. Kept for backward compatibility; for multi-action filters
   * use `actions` instead.
   */
  @IsOptional()
  @IsString()
  action?: string;

  /**
   * Filter to any of the listed actions. Accepts repeated `actions=…` query
   * params or a single comma-separated string (`actions=LEAD_PII_REVEAL,ORDER_ACCEPT`).
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value)) return value.flatMap((v) => String(v).split(','));
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  actions?: string[];

  @IsOptional()
  @IsUUID()
  actor_user_id?: string;

  /** Inclusive lower bound on `created_at` (ISO 8601). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Exclusive upper bound on `created_at` (ISO 8601). */
  @IsOptional()
  @IsDateString()
  to?: string;

  /** Free-text needle — matched against entity_id (UUIDs paste cleanly). */
  @IsOptional()
  @IsString()
  q?: string;

  /** Cursor (last row id from the previous page). */
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
