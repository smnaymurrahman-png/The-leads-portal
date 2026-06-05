import {
  BadRequestException,
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
  Query,
} from '@nestjs/common';
import { LeadType, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import {
  CreateLeadTypeColumnDto,
  ReorderLeadTypeColumnsDto,
  UpdateLeadTypeColumnDto,
} from './dto/lead-type-column.dto';
import { LeadSheetService } from './lead-sheet.service';
import { LeadTypeColumnsService } from './lead-type-columns.service';

/**
 * Column schema for the Leads sheet.
 *
 *   GET  /api/lead-type-columns?lead_type=…       all roles  — visible columns (sheet headers)
 *   GET  /api/lead-type-columns/admin?lead_type=… SUPER_ADMIN — every column incl. hidden
 *   POST /api/lead-type-columns                   SUPER_ADMIN — add a column
 *   PATCH /api/lead-type-columns/:id              SUPER_ADMIN — edit a column
 *   DELETE /api/lead-type-columns/:id             SUPER_ADMIN — remove a column
 *   POST /api/lead-type-columns/reorder           SUPER_ADMIN — full reorder
 *
 * Mutations are SUPER_ADMIN only — adding/renaming/removing columns alters
 * what every buyer sees + what CSV exports look like; this is intentionally
 * a high-privilege action.
 */
@Controller('lead-type-columns')
export class LeadTypeColumnsController {
  constructor(
    private readonly sheet: LeadSheetService,
    private readonly admin: LeadTypeColumnsService,
  ) {}

  @Get()
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  list(@Query('lead_type') leadType?: string) {
    return this.sheet.columnsFor(requireLeadType(leadType));
  }

  @Get('admin')
  @Roles(Role.SUPER_ADMIN)
  listAll(@Query('lead_type') leadType?: string) {
    return this.admin.listAll(requireLeadType(leadType));
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateLeadTypeColumnDto) {
    return this.admin.create(actor, dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadTypeColumnDto,
  ) {
    return this.admin.update(actor, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    await this.admin.remove(actor, id);
  }

  @Post('reorder')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  reorder(@CurrentUser() actor: AuthPrincipal, @Body() dto: ReorderLeadTypeColumnsDto) {
    return this.admin.reorder(actor, dto);
  }
}

function requireLeadType(value: string | undefined): LeadType {
  const lt = (value ?? '').toUpperCase();
  if (!Object.values(LeadType).includes(lt as LeadType)) {
    throw new BadRequestException(
      `lead_type must be one of ${Object.values(LeadType).join(', ')}`,
    );
  }
  return lt as LeadType;
}
