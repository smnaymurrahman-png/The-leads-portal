import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';

/**
 * Stripe webhook receiver.
 *
 * `@Public()` — exempt from JWT auth. The request is authenticated by the
 * Stripe webhook signature, verified against `STRIPE_WEBHOOK_SECRET`.
 */
@Public()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    return this.payments.handleWebhook(request.rawBody, signature);
  }
}
