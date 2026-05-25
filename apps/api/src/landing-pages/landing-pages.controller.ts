import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { LandingPagesService } from './landing-pages.service';

/** Landing pages. All staff may view; ADMIN/SUPER_ADMIN create / edit / delete. */
@Controller('landing-pages')
export class LandingPagesController {
  constructor(private readonly landingPages: LandingPagesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateLandingPageDto) {
    return this.landingPages.create(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  list() {
    return this.landingPages.list();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.landingPages.get(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLandingPageDto) {
    return this.landingPages.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.landingPages.remove(id);
  }

  @Get(':id/metrics')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT)
  metrics(@Param('id', ParseUUIDPipe) id: string) {
    return this.landingPages.metrics(id);
  }

  @Post(':id/rotate-secret')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  rotateSecret(@Param('id', ParseUUIDPipe) id: string) {
    return this.landingPages.rotateSecret(id);
  }
}
