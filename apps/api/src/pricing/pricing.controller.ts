import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { PricingService } from './pricing.service';

/**
 * Lead pricing. All staff may read prices; only SUPER_ADMIN may change them.
 */
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('leads')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  list() {
    return this.pricing.list();
  }

  @Put('leads')
  @Roles(Role.SUPER_ADMIN)
  replace(@CurrentUser() actor: AuthPrincipal, @Body() dto: UpdatePricingDto) {
    return this.pricing.replace(actor, dto.prices);
  }
}
