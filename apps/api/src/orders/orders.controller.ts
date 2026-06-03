import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import type { EnvironmentVariables } from '../config/env.validation';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import { OrdersService } from './orders.service';

/**
 * Order lifecycle — off-platform (WhatsApp) payment flow:
 *
 *   CLIENT  POST /orders                       — places the request
 *   AGENT   POST /orders/:id/payment-proof     — uploads screenshot
 *   AGENT   POST /orders/:id/cancel            — cancels uncollected order
 *   ADMIN   POST /orders/:id/accept            — verifies + activates
 *   ADMIN   POST /orders/:id/reject            — rejects with reason
 *           GET  /orders                       — role-scoped list
 *           GET  /orders/:id                   — role-scoped detail
 *           GET  /orders/:id/payment-proof-url — signed URL for the screenshot
 *           GET  /orders/:id/payment-proof     — streams the screenshot (token auth)
 */
@Controller('orders')
export class OrdersController {
  private readonly maxBytes: number;

  constructor(
    private readonly orders: OrdersService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxBytes = config.get('UPLOAD_MAX_MB', { infer: true }) * 1024 * 1024;
  }

  @Post()
  @Roles(Role.CLIENT)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateOrderDto) {
    return this.orders.create(actor, dto);
  }

  @Get()
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.orders.list(actor);
  }

  @Get(':id')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(actor, id);
  }

  /**
   * Multipart upload of the WhatsApp payment screenshot.
   *   field name: `file` (image/jpeg, image/png, image/webp, application/pdf)
   *   plus optional text fields: `payment_method`, `payment_reference`, `payment_note`
   * Agent only — and only for orders belonging to the agent's own clients.
   */
  @Post(':id/payment-proof')
  @Roles(Role.AGENT)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  uploadProof(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadPaymentProofDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.orders.uploadPaymentProof(actor, id, file, dto);
  }

  @Get(':id/payment-proof-url')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  paymentProofUrl(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.paymentProofUrl(actor, id);
  }

  /**
   * Streams the payment proof. Authenticated by the signed-URL token rather
   * than JWT — so the browser can render `<img src=…>` without juggling
   * `Authorization` headers. The token is bound to (order_id, principal,
   * expiry) and verified against `UPLOAD_SIGNING_SECRET`.
   */
  @Get(':id/payment-proof')
  @Public()
  @Header('Cache-Control', 'private, no-store')
  async streamProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mime, filename } = await this.orders.readPaymentProofWithToken(id, token);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post(':id/cancel')
  @Roles(Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(actor, id, dto);
  }

  @Post(':id/accept')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.accept(actor, id);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ) {
    return this.orders.reject(actor, id, dto.reject_note);
  }
}
