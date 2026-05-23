/** Emitted by intake when a lead is saved VALID — triggers auto-distribution. */
export const LEAD_VALID = 'lead.valid';

export interface LeadValidEvent {
  leadId: string;
}
