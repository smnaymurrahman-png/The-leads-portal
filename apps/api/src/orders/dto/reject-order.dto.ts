import { IsString, MinLength } from 'class-validator';

/** Payload for `POST /orders/:id/reject`. */
export class RejectOrderDto {
  @IsString()
  @MinLength(1)
  reject_note!: string;
}
