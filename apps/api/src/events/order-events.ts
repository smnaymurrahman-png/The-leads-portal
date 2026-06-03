/**
 * Internal order lifecycle events. The realtime module subscribes to these
 * and translates them into Socket.IO emissions to the relevant client / agent.
 *
 * Payments are off-platform (WhatsApp): the AGENT collects funds and uploads
 * a screenshot; ADMIN / SUPER_ADMIN verifies the screenshot and accepts.
 * So the events follow the AGENT → ADMIN handoff, not a Stripe webhook.
 */

/** Agent has uploaded the payment-proof screenshot — admin queue should refresh. */
export const ORDER_PROOF_SUBMITTED = 'order.proof_submitted';

/** Admin / Super-Admin accepted the proof; the order is now ACTIVE. */
export const ORDER_ACCEPTED = 'order.accepted';

/** Admin / Super-Admin rejected the proof or the original request. */
export const ORDER_REJECTED = 'order.rejected';

/** Order was cancelled (by the agent for non-payment, or by admin). */
export const ORDER_CANCELLED = 'order.cancelled';

interface OrderEventBase {
  orderId: string;
  publicOrderId: string;
  clientId: string;
  /** Agent who owns the client this order belongs to. */
  agentId: string;
}

export interface OrderProofSubmittedEvent extends OrderEventBase {
  uploadedBy: string;
}

export interface OrderAcceptedEvent extends OrderEventBase {
  acceptedBy: string;
  invoiceId: string;
  invoiceNumber: string;
}

export interface OrderRejectedEvent extends OrderEventBase {
  rejectedBy: string;
  rejectNote: string;
}

export interface OrderCancelledEvent extends OrderEventBase {
  cancelledBy: string;
  reason: string | null;
}
