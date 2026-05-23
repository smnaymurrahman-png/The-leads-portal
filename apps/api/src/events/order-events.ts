/**
 * Internal event names emitted by the payments module. Phase 6 (realtime)
 * subscribes to these to push live updates to clients.
 */
export const ORDER_PAID = 'order.paid';
export const ORDER_PAYMENT_FAILED = 'order.payment_failed';

export interface OrderPaidEvent {
  orderId: string;
  publicOrderId: string;
  clientId: string;
}

export interface OrderPaymentFailedEvent {
  orderId: string;
  publicOrderId: string;
  clientId: string;
}
