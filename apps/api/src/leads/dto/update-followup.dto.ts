import { FollowupStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Body of `PATCH /api/lead-assignments/:id/followup`. CLIENT-only. */
export class UpdateFollowupDto {
  @IsEnum(FollowupStatus)
  status!: FollowupStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
