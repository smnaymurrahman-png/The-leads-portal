import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class AssignSampleDto {
  @IsArray() @IsUUID('4', { each: true })
  lead_ids!: string[];

  // assign directly to this client
  @IsOptional() @IsUUID('4')
  client_id?: string;
}
