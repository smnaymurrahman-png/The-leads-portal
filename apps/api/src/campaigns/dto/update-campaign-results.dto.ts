import { IsObject } from 'class-validator';

/** Payload for `PATCH /campaigns/:id/results`. */
export class UpdateCampaignResultsDto {
  @IsObject()
  results!: Record<string, unknown>;
}
