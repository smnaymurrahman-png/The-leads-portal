import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { AssignSampleDto } from './dto/assign-sample.dto';
import { CreateSampleRequestDto } from './dto/create-sample-request.dto';
import { RejectSampleDto } from './dto/reject-sample.dto';
import { SamplesService } from './samples.service';

@Controller('samples')
export class SamplesController {
  constructor(private readonly samples: SamplesService) {}

  // ── Sample pool (admin/super-admin) ─────────────────────────────────────

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('pool')
  listPool() {
    return this.samples.listPool();
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('pool/:leadId')
  @HttpCode(HttpStatus.OK)
  addToPool(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.samples.addToPool(leadId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete('pool/:leadId')
  removeFromPool(@Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.samples.removeFromPool(leadId);
  }

  // ── Sample requests ───────────────────────────────────────────────────────

  @Roles(Role.CLIENT)
  @Post('requests')
  createRequest(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateSampleRequestDto) {
    return this.samples.createRequest(actor, dto);
  }

  @Get('requests')
  listRequests(@CurrentUser() actor: AuthPrincipal) {
    return this.samples.listRequests(actor);
  }

  @Get('requests/:id')
  getRequest(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.samples.getRequest(actor, id);
  }

  @Roles(Role.AGENT)
  @Patch('requests/:id/forward')
  forwardToAdmin(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.samples.forwardToAdmin(actor, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  @Patch('requests/:id/reject')
  rejectRequest(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectSampleDto,
  ) {
    return this.samples.rejectRequest(actor, id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  @Post('requests/:id/assign')
  assignLeads(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSampleDto,
  ) {
    return this.samples.assignLeads(actor, id, dto);
  }

  // ── Client sample leads (sheet view) ─────────────────────────────────────

  @Roles(Role.CLIENT)
  @Get('my-leads')
  listClientSampleLeads(@CurrentUser() actor: AuthPrincipal) {
    return this.samples.listClientSampleLeads(actor);
  }
}
