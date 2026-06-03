import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ORDER_ACCEPTED,
  ORDER_CANCELLED,
  ORDER_PROOF_SUBMITTED,
  ORDER_REJECTED,
  type OrderAcceptedEvent,
  type OrderCancelledEvent,
  type OrderProofSubmittedEvent,
  type OrderRejectedEvent,
} from '../events/order-events';
import {
  REPLACEMENT_STATUS_CHANGED,
  type ReplacementStatusChangedEvent,
} from '../events/realtime-events';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Translates internal domain events into socket events pushed to the relevant
 * principals (client, agent, admin).
 */
@Injectable()
export class RealtimeListener {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(ORDER_PROOF_SUBMITTED)
  onProofSubmitted(event: OrderProofSubmittedEvent): void {
    // Agent already knows (they just uploaded). The client should see the
    // status flip in their portal too.
    this.gateway.emitToPrincipal(event.clientId, 'order.status_changed', {
      orderId: event.orderId,
      publicOrderId: event.publicOrderId,
      status: 'PROOF_SUBMITTED',
    });
    // Admins listen on the global "admin" room (see RealtimeGateway).
    this.gateway.emitToAdmins('order.proof_submitted', {
      orderId: event.orderId,
      publicOrderId: event.publicOrderId,
    });
  }

  @OnEvent(ORDER_ACCEPTED)
  onOrderAccepted(event: OrderAcceptedEvent): void {
    this.gateway.emitToPrincipal(event.clientId, 'order.status_changed', {
      orderId: event.orderId,
      publicOrderId: event.publicOrderId,
      status: 'ACTIVE',
      invoiceId: event.invoiceId,
      invoiceNumber: event.invoiceNumber,
    });
    this.gateway.emitToPrincipal(event.agentId, 'order.status_changed', {
      orderId: event.orderId,
      publicOrderId: event.publicOrderId,
      status: 'ACTIVE',
    });
  }

  @OnEvent(ORDER_REJECTED)
  onOrderRejected(event: OrderRejectedEvent): void {
    for (const principal of [event.clientId, event.agentId]) {
      this.gateway.emitToPrincipal(principal, 'order.status_changed', {
        orderId: event.orderId,
        publicOrderId: event.publicOrderId,
        status: 'REJECTED',
        note: event.rejectNote,
      });
    }
  }

  @OnEvent(ORDER_CANCELLED)
  onOrderCancelled(event: OrderCancelledEvent): void {
    for (const principal of [event.clientId, event.agentId]) {
      this.gateway.emitToPrincipal(principal, 'order.status_changed', {
        orderId: event.orderId,
        publicOrderId: event.publicOrderId,
        status: 'CANCELLED',
        reason: event.reason,
      });
    }
  }

  @OnEvent(REPLACEMENT_STATUS_CHANGED)
  onReplacementStatusChanged(event: ReplacementStatusChangedEvent): void {
    this.gateway.emitToPrincipal(event.clientId, 'replacement.status_changed', {
      replacementId: event.replacementId,
      status: event.status,
    });
  }
}
