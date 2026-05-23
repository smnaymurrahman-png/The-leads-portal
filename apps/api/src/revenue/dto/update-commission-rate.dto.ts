import { IsNumber, Max, Min } from 'class-validator';

/** Commission rate as a fraction of a paid order total (e.g. 0.1 = 10%). */
export class UpdateCommissionRateDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  rate!: number;
}
