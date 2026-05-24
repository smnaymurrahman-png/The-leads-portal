import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Add an email or phone to the suppression list. At least one must be set —
 * empty entries would suppress every lead.
 */
export class CreateSuppressionDto {
  @IsOptional()
  @ValidateIf((o) => !o.phone || (o.email && o.email.length > 0))
  @IsEmail()
  email?: string;

  @IsOptional()
  @ValidateIf((o) => !o.email || (o.phone && o.phone.length > 0))
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
