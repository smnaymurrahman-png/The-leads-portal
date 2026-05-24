import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { IntakeLeadDto } from './intake-lead.dto';

/** Body of `POST /api/intake/:landingPageId/bulk` — up to 5,000 rows. */
export class BulkIntakeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5_000)
  @ValidateNested({ each: true })
  @Type(() => IntakeLeadDto)
  rows!: IntakeLeadDto[];
}
