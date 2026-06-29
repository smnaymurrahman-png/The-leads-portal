import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupAgentDto {
  @IsString()
  @MinLength(1)
  full_name!: string;

  @IsEmail()
  work_email!: string;

  @IsString()
  @MinLength(1)
  phone!: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  business_name?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
