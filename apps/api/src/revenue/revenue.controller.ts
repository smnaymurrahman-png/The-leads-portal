import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateCommissionRateDto } from './dto/update-commission-rate.dto';
import { RevenueService } from './revenue.service';

/** Revenue — sales, expenses, commissions, profit/loss. ADMIN / SUPER_ADMIN. */
@Controller('revenue')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class RevenueController {
  constructor(private readonly revenue: RevenueService) {}

  @Get('summary')
  summary() {
    return this.revenue.summary();
  }

  @Get('commissions')
  commissions() {
    return this.revenue.listCommissions();
  }

  @Get('expenses')
  expenses() {
    return this.revenue.listExpenses();
  }

  @Post('expenses')
  createExpense(@Body() dto: CreateExpenseDto) {
    return this.revenue.createExpense(dto);
  }

  @Get('commission-rate')
  async commissionRate() {
    return { rate: await this.revenue.getCommissionRate() };
  }

  @Put('commission-rate')
  @Roles(Role.SUPER_ADMIN)
  setCommissionRate(@CurrentUser() actor: AuthPrincipal, @Body() dto: UpdateCommissionRateDto) {
    return this.revenue.setCommissionRate(actor, dto.rate);
  }
}
