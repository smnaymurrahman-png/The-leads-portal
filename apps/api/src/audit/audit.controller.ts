import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

/** SUPER_ADMIN audit viewer. */
@Controller('audit')
@Roles(Role.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: ListAuditQueryDto) {
    return this.audit.list(query);
  }

  /** Distinct actions + actors in the same filter window. */
  @Get('summary')
  summary(@Query() query: ListAuditQueryDto) {
    return this.audit.summary(query);
  }
}
