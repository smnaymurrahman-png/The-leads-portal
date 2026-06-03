import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.invoices.list(actor);
  }

  @Get(':id')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.get(actor, id);
  }

  /**
   * Issues a short-lived signed URL for the PDF. The browser then fetches
   * `GET /invoices/:id/pdf?token=…` without sending the JWT.
   */
  @Get(':id/pdf-url')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  pdfUrl(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.signedPdfUrl(actor, id);
  }

  /**
   * Streams the PDF. Authenticated by the signed-URL token, not JWT — so the
   * browser can render it directly in an <iframe>/<embed>. The token is
   * bound to (invoice_id, principal_id, expiry) and HMAC-signed with
   * `UPLOAD_SIGNING_SECRET`.
   */
  @Get(':id/pdf')
  @Public()
  @Header('Cache-Control', 'private, no-store')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, invoice } = await this.invoices.readPdfWithToken(id, token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${invoice.invoice_number}.pdf"`,
    );
    res.send(buffer);
  }
}
