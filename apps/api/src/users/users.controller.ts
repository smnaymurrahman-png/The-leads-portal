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
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

/** Internal-staff management — restricted to SUPER_ADMIN and ADMIN. */
@Controller('users')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query.role);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  /** SUPER_ADMIN only — reset any staff user's password without knowing the current one. */
  @Roles(Role.SUPER_ADMIN)
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.users.resetPassword(id, dto.newPassword);
  }

  @Delete(':id')
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.remove(actor, id);
  }
}
