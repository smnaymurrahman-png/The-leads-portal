import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

/**
 * Self-service profile update. Whichever fields apply to the principal's
 * account kind (User vs Client) get written; the rest are ignored. Email,
 * role, ownership and password are NOT editable here — there are
 * dedicated endpoints for those.
 */
export class UpdateProfileDto {
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

  // Staff-only fields below — silently dropped for client principals.
  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  employee_id?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  linkedin_url?: string;

  // Client-only fields below — silently dropped for staff principals.
  @IsOptional()
  @IsString()
  business_name?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
