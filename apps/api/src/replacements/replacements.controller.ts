import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { CreateReplacementDto } from './dto/create-replacement.dto';
import { DenyReplacementDto } from './dto/deny-replacement.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { ReplacementPolicyService } from './replacement-policy.service';
import { ReplacementsService } from './replacements.service';

/**
 * Replacement workflow. CLIENT requests; ADMIN/SUPER_ADMIN approve or deny;
 * AGENT has read-only visibility.
 */
@Controller('replacements')
export class ReplacementsController {
  constructor(
    private readonly replacements: ReplacementsService,
    private readonly policy: ReplacementPolicyService,
  ) {}

  @Post()
  @Roles(Role.CLIENT)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateReplacementDto) {
    return this.replacements.create(actor, dto);
  }

  @Get()
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.replacements.list(actor);
  }

  // Declared before `:id` so these static paths are not captured by it.
  @Get('policy')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  getPolicy() {
    return this.policy.get();
  }

  @Put('policy')
  @Roles(Role.SUPER_ADMIN)
  updatePolicy(@CurrentUser() actor: AuthPrincipal, @Body() dto: UpdatePolicyDto) {
    return this.policy.update(actor, dto);
  }

  /** Replacement-rate metric — a CLIENT sees their own; staff may pass clientId. */
  @Get('rate')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  rate(@CurrentUser() actor: AuthPrincipal, @Query('clientId') clientId?: string) {
    const target = actor.role === Role.CLIENT ? actor.id : (clientId ?? actor.id);
    return this.replacements.rate(target);
  }

  @Get(':id')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.replacements.get(actor, id);
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.replacements.approve(actor, id);
  }

  @Post(':id/deny')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  deny(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DenyReplacementDto,
  ) {
    return this.replacements.deny(actor, id, dto.note);
  }
}
