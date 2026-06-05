import { LeadType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Supported `source` prefixes — anything else is rejected at validation time.
 * Keep in sync with `LeadSheetService.resolveRaw()` resolver switch.
 */
const SOURCE_PATTERN =
  /^(lead\.(full_name|email|phone|address|country|state|zip|source_url|public_lead_id|captured_at|lead_state)|qualification\.[a-z0-9_]+|system\.(public_lead_id|captured_at|lead_state|landing_page)|assignment\.(delivery_status|delivered_at|followup_status)|order\.public_order_id|replacement\.status)$/;

const DATA_TYPES = ['string', 'phone', 'email', 'date', 'datetime', 'money', 'integer', 'boolean', 'enum'] as const;
const MASK_KINDS = ['ssn', 'account', 'routing', 'dl', 'last4', 'full'] as const;

/** Body of `POST /api/lead-type-columns`. */
export class CreateLeadTypeColumnDto {
  @IsEnum(LeadType)
  lead_type!: LeadType;

  /** Stable key inside this lead_type. snake_case. */
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,49}$/, {
    message: 'field_key must be snake_case (a-z, 0-9, _), starting with a letter',
  })
  field_key!: string;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @Matches(SOURCE_PATTERN, {
    message:
      'source must look like lead.<col> | qualification.<key> | system.<key> | assignment.<key> | order.public_order_id | replacement.status',
  })
  source!: string;

  @IsOptional()
  @IsIn(DATA_TYPES as readonly string[])
  data_type?: (typeof DATA_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;

  /** Required when `sensitive=true`. */
  @ValidateIf((o: CreateLeadTypeColumnDto) => o.sensitive === true)
  @IsIn(MASK_KINDS as readonly string[])
  mask_kind?: (typeof MASK_KINDS)[number];

  @IsOptional()
  @IsBoolean()
  default_visible?: boolean;
}

/** Body of `PATCH /api/lead-type-columns/:id`. Every field optional. */
export class UpdateLeadTypeColumnDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @Matches(SOURCE_PATTERN, {
    message:
      'source must look like lead.<col> | qualification.<key> | system.<key> | assignment.<key> | order.public_order_id | replacement.status',
  })
  source?: string;

  @IsOptional()
  @IsIn(DATA_TYPES as readonly string[])
  data_type?: (typeof DATA_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;

  @IsOptional()
  @IsIn(MASK_KINDS as readonly string[])
  mask_kind?: (typeof MASK_KINDS)[number] | null;

  @IsOptional()
  @IsBoolean()
  default_visible?: boolean;
}

/** Body of `POST /api/lead-type-columns/reorder`. */
export class ReorderLeadTypeColumnsDto {
  @IsEnum(LeadType)
  lead_type!: LeadType;

  /**
   * Full list of `field_key`s in the new display order. Must contain exactly
   * the same field_keys as currently exist for this lead_type (no adds or
   * removes — use POST/DELETE for that).
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @Type(() => String)
  order!: string[];
}
