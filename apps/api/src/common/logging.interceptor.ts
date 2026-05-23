import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs';

/**
 * Request logging — one line per HTTP request: method, path, status, duration.
 * Errors are logged here too (with status) and again, in full, by the
 * AllExceptionsFilter.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          this.logger.log(`${method} ${originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`);
        },
        error: (error: { status?: number }) => {
          this.logger.warn(`${method} ${originalUrl} ${error?.status ?? 500} ${Date.now() - startedAt}ms`);
        },
      }),
    );
  }
}
