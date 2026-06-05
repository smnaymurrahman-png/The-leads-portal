import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { RevealCellsDto } from './dto/reveal.dto';
import { UpdateFollowupDto } from './dto/update-followup.dto';
import { LeadSheetService } from './lead-sheet.service';

/**
 *   PATCH /api/lead-assignments/:id/followup    CLIENT — update follow-up state
 *   POST  /api/lead-assignments/:id/reveal      role-scoped — decrypt sensitive cells (audit-logged)
 */
@Controller('lead-assignments')
export class LeadAssignmentsController {
  constructor(private readonly sheet: LeadSheetService) {}

  @Patch(':id/followup')
  @Roles(Role.CLIENT)
  updateFollowup(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFollowupDto,
  ) {
    return this.sheet.updateFollowup(actor, id, dto.status, dto.note ?? null);
  }

  @Post(':id/reveal')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  reveal(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevealCellsDto,
  ) {
    return this.sheet.revealCells(actor, id, dto.field_keys);
  }
}
