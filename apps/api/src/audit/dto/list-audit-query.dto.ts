import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Filters for the audit viewer. */
export class ListAuditQueryDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
