import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Payload for `PUT /distribution/lead-types/:leadType`. Omitted fields are
 * left unchanged.
 */
export class LeadTypeControlsDto {
  /** Pause / resume auto-distribution for this lead type. */
  @IsOptional()
  @IsBoolean()
  paused?: boolean;

  /** Toggle hold-for-review for this lead type. */
  @IsOptional()
  @IsBoolean()
  hold?: boolean;
}
