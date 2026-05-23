import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import type { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  // `rawBody: true` keeps the unparsed request body available on
  // `request.rawBody` — required to verify the intake webhook's HMAC signature.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // Trust the Railway/Vercel proxy so `req.ip` is the real client IP — the
  // rate limiter keys on it.
  app.set('trust proxy', 1);

  // All routes are served under /api.
  app.setGlobalPrefix('api');

  // Request logging + a single error-monitoring hook point.
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Strict input validation on every endpoint:
  //  - whitelist          strips properties not declared on the DTO
  //  - forbidNonWhitelisted  rejects requests carrying unknown properties
  //  - transform          coerces payloads into their DTO classes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS limited to the Next.js web app origin.
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
  });

  // Flush Prisma connections cleanly on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
