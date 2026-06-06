import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter — formats errors consistently and is the single
 * hook point for external error monitoring.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error('Non-HTTP exception', exception as Error);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${request.originalUrl} → ${status}`, exception as Error);
      // ──────────────────────────────────────────────────────────────────
      //  ERROR MONITORING HOOK — wire an external monitor here before launch,
      //  e.g.  Sentry.captureException(exception, { extra: { url, status } });
      // ──────────────────────────────────────────────────────────────────
    }

    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
