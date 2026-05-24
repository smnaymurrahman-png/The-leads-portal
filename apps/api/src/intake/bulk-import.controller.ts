import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkIntakeDto } from './dto/bulk-intake.dto';
import { IntakeService } from './intake.service';

/**
 * Authenticated bulk lead import — runs N rows through the same intake
 * pipeline as the signed webhook, without requiring HMAC because the caller
 * is already proven via JWT. Mounted as a sibling of the public webhook
 * controller so the @Public decorator boundary stays clean.
 */
@Controller('landing-pages')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class BulkImportController {
  constructor(private readonly intake: IntakeService) {}

  @Post(':id/bulk-import')
  @HttpCode(HttpStatus.OK)
  bulk(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkIntakeDto) {
    return this.intake.ingestBulk(id, dto.rows);
  }
}
