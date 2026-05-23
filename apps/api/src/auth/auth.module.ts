import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { EnvironmentVariables } from '../config/env.validation';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './jwt.strategy';
import { OwnershipService } from './ownership.service';

/**
 * Wires authentication and RBAC. The two guards are registered as `APP_GUARD`
 * so they run on every request, in order: authenticate, then authorize.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    OwnershipService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  // JwtModule is re-exported so other modules (e.g. the realtime gateway) can
  // verify the same JWT used by REST.
  exports: [OwnershipService, JwtModule],
})
export class AuthModule {}
