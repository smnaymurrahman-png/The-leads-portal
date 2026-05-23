import { IsUUID } from 'class-validator';

/** Payload for `POST /distribution/leads/:leadId/assign`. */
export class ManualAssignDto {
  /** The order to assign the lead to (overrides the matching algorithm). */
  @IsUUID()
  orderId!: string;
}
