import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { LeadType } from '@prisma/client';

export class SignupClientDto {
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
  whatsapp?: string;

  @IsEnum(LeadType)
  targeted_lead_type!: LeadType;

  @IsOptional()
  @IsString()
  business_name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsUUID()
  agent_id!: string;
}
