import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, type LoginResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthPrincipal } from './types';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Public — exchange email + password for a JWT access token.
   * Rate-limited to 10 attempts per minute per IP to blunt credential stuffing.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password);
  }

  /** Identity of the current principal. Any authenticated role. */
  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      scopeId: user.scopeId,
      kind: user.kind,
    };
  }

  /**
   * Self-service password change. Any authenticated role can update their
   * own credentials; the current password must be supplied so a stolen
   * cookie alone can't rotate the password and lock the owner out.
   * Throttled to 5 attempts/minute per IP.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() actor: AuthPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(actor, dto.currentPassword, dto.newPassword);
  }

  /**
   * Full editable profile — phone, whatsapp, role-specific fields. Pulled
   * separately from /auth/me so that lean endpoint stays cheap (it's called
   * by every authenticated page load via getSession()).
   */
  @Get('me/profile')
  fullProfile(@CurrentUser() actor: AuthPrincipal) {
    return this.auth.fullProfile(actor);
  }

  /** Self-service profile edit — name, phone, role-specific fields. */
  @Patch('me')
  updateProfile(@CurrentUser() actor: AuthPrincipal, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(actor, dto);
  }
}
