import { IsString, IsUUID, MinLength } from 'class-validator';

/** Payload for `POST /replacements` — a CLIENT requesting a replacement. */
export class CreateReplacementDto {
  /** The delivered lead being replaced. */
  @IsUUID()
  original_lead_id!: string;

  /** Must be one of the policy's valid reasons (checked in the service). */
  @IsString()
  @MinLength(1)
  reason!: string;
}
