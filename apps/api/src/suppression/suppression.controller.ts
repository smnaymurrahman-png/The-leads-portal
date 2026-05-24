import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateSuppressionDto } from './dto/create-suppression.dto';
import { SuppressionService } from './suppression.service';

/** Manage the suppression registry — SUPER_ADMIN only. */
@Controller('suppression')
@Roles(Role.SUPER_ADMIN)
export class SuppressionController {
  constructor(private readonly suppression: SuppressionService) {}

  @Get()
  list(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.suppression.list({
      search: search?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreateSuppressionDto) {
    return this.suppression.create(dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppression.remove(id);
  }
}
