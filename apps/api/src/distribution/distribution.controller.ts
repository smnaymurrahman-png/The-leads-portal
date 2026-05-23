import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { LeadType, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { DistributionControlsService } from './distribution-controls.service';
import { DistributionService } from './distribution.service';
import { LeadTypeControlsDto } from './dto/lead-type-controls.dto';
import { ManualAssignDto } from './dto/manual-assign.dto';

/** Manual distribution + pause/hold controls — ADMIN / SUPER_ADMIN only. */
@Controller('distribution')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class DistributionController {
  constructor(
    private readonly distribution: DistributionService,
    private readonly controls: DistributionControlsService,
  ) {}

  /** Current pause / hold-for-review state per lead type. */
  @Get('controls')
  getControls() {
    return this.controls.get();
  }

  /** Pause/resume auto-distribution or toggle hold-for-review for a lead type. */
  @Put('lead-types/:leadType')
  setLeadTypeControls(
    @CurrentUser() actor: AuthPrincipal,
    @Param('leadType', new ParseEnumPipe(LeadType)) leadType: LeadType,
    @Body() dto: LeadTypeControlsDto,
  ) {
    return this.controls.setLeadType(actor, leadType, dto);
  }

  /** Pause a single order — it leaves the eligible set until resumed. */
  @Post('orders/:orderId/pause')
  @HttpCode(HttpStatus.OK)
  pauseOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.distribution.pauseOrder(orderId);
  }

  @Post('orders/:orderId/resume')
  @HttpCode(HttpStatus.OK)
  resumeOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.distribution.resumeOrder(orderId);
  }

  /** Manually assign a lead (e.g. from the UNSOLD_POOL) to a specific order. */
  @Post('leads/:leadId/assign')
  @HttpCode(HttpStatus.OK)
  manualAssign(
    @CurrentUser() actor: AuthPrincipal,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: ManualAssignDto,
  ) {
    return this.distribution.manualAssign(actor, leadId, dto.orderId);
  }

  /** Re-run the auto matching algorithm for a single lead. */
  @Post('leads/:leadId/distribute')
  @HttpCode(HttpStatus.OK)
  redistribute(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.distribution.distribute(leadId);
  }
}
