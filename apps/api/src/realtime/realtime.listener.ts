import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ORDER_PAID,
  ORDER_PAYMENT_FAILED,
  type OrderPaidEvent,
  type OrderPaymentFailedEvent,
} from '../events/order-events';
import {
  REPLACEMENT_STATUS_CHANGED,
  type ReplacementStatusChangedEvent,
} from '../events/realtime-events';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Translates internal domain events into socket events pushed to the relevant
 * client's private room.
 */
@Injectable()
export class RealtimeListener {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(ORDER_PAID)
  onOrderPaid(event: OrderPaidEvent): void {
    this.gateway.emitToPrincipal(event.clientId, 'payment.paid', {
      orderId: event.orderId,
      publicOrderId: event.publicOrderId,
    });
    this.gateway.emitToPrincipal(event.clientId, 'order.status_changed', {
      orderId: event.orderId,
      publicOrderId: event.publicOrderId,
      status: 'ACTIVE',
    });
  }

  @OnEvent(ORDER_PAYMENT_FAILED)
  onOrderPaymentFailed(event: OrderPaymentFailedEvent): void {
    this.gateway.emitToPrincipal(event.clientId, 'order.status_changed', {
      orderId: event.orderId,
      publicOrderId: event.publicOrderId,
      status: 'PAYMENT_FAILED',
    });
  }

  @OnEvent(REPLACEMENT_STATUS_CHANGED)
  onReplacementStatusChanged(event: ReplacementStatusChangedEvent): void {
    this.gateway.emitToPrincipal(event.clientId, 'replacement.status_changed', {
      replacementId: event.replacementId,
      status: event.status,
    });
  }
}
