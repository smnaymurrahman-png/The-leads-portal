import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

/** Payload for onboarding an internal staff member (incl. agents). */
export class CreateUserDto {
  /** CLIENT is intentionally excluded — buyers live in the `clients` table. */
  @IsIn([Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT])
  role!: Role;

  @IsString()
  @MinLength(1)
  full_name!: string;

  @IsEmail()
  work_email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

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
}
