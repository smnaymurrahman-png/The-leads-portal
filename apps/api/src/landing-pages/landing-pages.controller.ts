import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { LandingPagesService } from './landing-pages.service';

/** Landing pages. All staff may view; ADMIN/SUPER_ADMIN create. */
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
}
