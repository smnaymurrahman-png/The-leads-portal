import { IsOptional, IsString } from 'class-validator';

export class RejectSampleDto {
  @IsOptional() @IsString()
  reason?: string;
}
