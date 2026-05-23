import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/** Encrypted third-party API keys — SUPER_ADMIN only. */
@Controller('api-keys')
@Roles(Role.SUPER_ADMIN)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  create(@Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(dto);
  }

  @Get()
  list() {
    return this.apiKeys.list();
  }

  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeys.revoke(id);
  }
}
