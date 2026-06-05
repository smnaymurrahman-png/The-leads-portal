import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

/** Body of `POST /api/lead-assignments/:id/reveal`. */
export class RevealCellsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  field_keys!: string[];
}
