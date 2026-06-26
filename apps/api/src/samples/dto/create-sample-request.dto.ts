import { DeliveryMode, LeadType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSampleRequestDto {
  @IsEnum(LeadType)
  lead_type!: LeadType;

  @IsInt() @Min(1) @Max(20)
  quantity!: number;

  @IsEnum(DeliveryMode)
  delivery_mode!: DeliveryMode;

  @IsOptional() @IsString()
  state_filter?: string;

  @IsOptional() @IsString()
  zip_filter?: string;

  @IsOptional() @IsString()
  notes?: string;
}
