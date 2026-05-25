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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

/**
 * Client (buyer) management. AGENT, ADMIN and SUPER_ADMIN may use it; an
 * AGENT only ever sees and touches the clients they own.
 */
@Controller('clients')
@Roles(Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateClientDto) {
    return this.clients.create(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.clients.list(actor);
  }

  @Get(':id')
  get(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.get(actor, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(actor, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.remove(actor, id);
  }
}
