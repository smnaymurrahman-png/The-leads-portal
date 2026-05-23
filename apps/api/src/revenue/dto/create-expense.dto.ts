import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  category!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsUUID()
  campaign_id?: string;

  @IsOptional()
  @IsDateString()
  incurred_at?: string;
}
