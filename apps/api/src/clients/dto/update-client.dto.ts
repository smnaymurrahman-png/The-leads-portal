import { AccountStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Editable fields of a client. Email and password are not changed here. */
export class UpdateClientDto {
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
  business_name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  /** Reassign the owning agent — ADMIN/SUPER_ADMIN only (enforced in service). */
  @IsOptional()
  @IsUUID()
  agent_id?: string;
}
