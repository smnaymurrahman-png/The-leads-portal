import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

/** Imports AuthModule for the shared `OwnershipService`. */
@Module({
  imports: [AuthModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
