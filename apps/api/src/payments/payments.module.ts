import { Module } from '@nestjs/common';
import { RevenueModule } from '../revenue/revenue.module';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [StripeModule, RevenueModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
