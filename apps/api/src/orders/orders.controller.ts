import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { CreateOrderDto } from './dto/create-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { OrdersService } from './orders.service';

/**
 * Order lifecycle. CLIENT requests; ADMIN/SUPER_ADMIN accept or reject;
 * AGENT views only. Payment state changes arrive via the Stripe webhook.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Roles(Role.CLIENT)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateOrderDto) {
    return this.orders.create(actor, dto);
  }

  @Get()
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.orders.list(actor);
  }

  @Get(':id')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(actor, id);
  }

  @Post(':id/accept')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.accept(actor, id);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ) {
    return this.orders.reject(actor, id, dto.reject_note);
  }

  /** Re-issue the Stripe invoice for an unpaid / failed order. */
  @Post(':id/payment-link')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.CLIENT)
  @HttpCode(HttpStatus.OK)
  regenerate(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.regeneratePaymentLink(actor, id);
  }

  /** Refund a paid order via Stripe and cancel it. */
  @Post(':id/refund')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  refund(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.refund(actor, id);
  }
}
