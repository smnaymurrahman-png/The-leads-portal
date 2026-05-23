import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

/** Provides the shared Stripe client to the orders and payments modules. */
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
