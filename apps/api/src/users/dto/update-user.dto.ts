import { AccountStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

/** Editable fields of a staff member. Role and email are immutable here. */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  full_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  employee_id?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  linkedin_url?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
