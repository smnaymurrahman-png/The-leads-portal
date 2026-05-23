import { IsString, MinLength } from 'class-validator';

/** Payload for `POST /replacements/:id/deny`. */
export class DenyReplacementDto {
  @IsString()
  @MinLength(1)
  note!: string;
}
