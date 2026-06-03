import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of `POST /api/orders/:id/payment-proof` (multipart/form-data, alongside
 * the `file` field). Every text field is optional — the screenshot is the
 * mandatory part. The fields below are how the agent annotates *what* the
 * client paid and *how*, so the admin verification step has context.
 */
export class UploadPaymentProofDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod;

  /** Txn ID / sender name / last 4 digits / whatever's on the screenshot. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  payment_reference?: string;

  /** Free-form note. "$200 confirmed via Bkash, sender: 8801…". */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  payment_note?: string;
}
