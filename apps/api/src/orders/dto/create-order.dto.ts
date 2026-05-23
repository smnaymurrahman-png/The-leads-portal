import { DeliveryMode, LeadType } from '@prisma/client';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

/** An order request placed by a CLIENT. */
export class CreateOrderDto {
  @IsEnum(LeadType)
  lead_type!: LeadType;

  @IsEnum(DeliveryMode)
  delivery_mode!: DeliveryMode;

  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  /** Free-form targeting: geo + qualification, e.g. { geo: {...}, qualification: {...} }. */
  @IsObject()
  criteria!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requirements?: string;
}
