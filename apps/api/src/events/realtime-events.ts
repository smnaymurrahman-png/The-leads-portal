/**
 * Internal events consumed by the realtime layer (Phase 7).
 */

/** Emitted by the distribution engine after an assignment is committed. */
export const LEAD_ASSIGNED = 'lead.assigned';

export interface LeadAssignedEvent {
  assignmentId: string;
}

/**
 * Emitted when a replacement changes status. Wired into the realtime layer
 * now; the replacement workflow that emits it arrives in a later phase.
 */
export const REPLACEMENT_STATUS_CHANGED = 'replacement.status_changed';

export interface ReplacementStatusChangedEvent {
  clientId: string;
  replacementId: string;
  status: string;
}
