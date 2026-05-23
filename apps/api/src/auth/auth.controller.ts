import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, type LoginResult } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
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
}
