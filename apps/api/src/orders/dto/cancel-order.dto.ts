import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body of `POST /api/orders/:id/cancel`. */
export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
