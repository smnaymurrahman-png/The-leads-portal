import { DeliveryMode, LeadType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';

/** A single price point: lead type × delivery mode → unit price (USD). */
export class LeadPriceDto {
  @IsEnum(LeadType)
  lead_type!: LeadType;

  @IsEnum(DeliveryMode)
  delivery_mode!: DeliveryMode;

  @IsNumber()
  @Min(0)
  unit_price!: number;
}

/** Payload for `PUT /pricing/leads` — replaces the whole price list. */
export class UpdatePricingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeadPriceDto)
  prices!: LeadPriceDto[];
}
