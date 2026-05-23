import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignResultsDto } from './dto/update-campaign-results.dto';

/**
 * Campaigns. All staff may view; only ADMIN/SUPER_ADMIN create or edit results.
 */
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(actor, dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  list() {
    return this.campaigns.list();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaigns.get(id);
  }

  @Patch(':id/results')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignResultsDto,
  ) {
    return this.campaigns.updateResults(id, dto.results);
  }
}
