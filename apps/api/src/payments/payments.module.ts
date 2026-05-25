import { Module } from '@nestjs/common';
import { RevenueModule } from '../revenue/revenue.module';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [StripeModule, RevenueModule],
  controllers: [PaymentsController, TransactionsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
