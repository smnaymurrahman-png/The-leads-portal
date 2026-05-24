import { IsString, MinLength } from 'class-validator';

/** Body of `POST /api/auth/change-password` — the caller's own credentials. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
