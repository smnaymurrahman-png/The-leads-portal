import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Payload for creating a buyer (client) account. */
export class CreateClientDto {
  @IsString()
  @MinLength(1)
  full_name!: string;

  @IsEmail()
  email!: string;

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
  business_name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  /**
   * Owning agent. Required when an ADMIN/SUPER_ADMIN creates the client;
   * ignored for an AGENT, who is always recorded as the owner.
   */
  @IsOptional()
  @IsUUID()
  agent_id?: string;
}
