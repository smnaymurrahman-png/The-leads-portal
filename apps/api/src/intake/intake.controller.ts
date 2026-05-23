import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  type RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { IntakeLeadDto } from './dto/intake-lead.dto';
import { IntakeService } from './intake.service';

/**
 * Lead intake webhook for WordPress landing pages.
 *
 * `@Public()` — exempt from JWT auth. The request is instead authenticated by
 * an HMAC-SHA256 signature header verified against the landing page's
 * `intake_secret`. Rate-limited to 60 requests per minute per IP.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('intake')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Post(':landingPageId/lead')
  @HttpCode(HttpStatus.OK)
  ingest(
    @Param('landingPageId', ParseUUIDPipe) landingPageId: string,
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-intake-signature') signature: string | undefined,
    @Body() dto: IntakeLeadDto,
  ) {
    return this.intake.ingest(landingPageId, request.rawBody, signature, dto);
  }
}
