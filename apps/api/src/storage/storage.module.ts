import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Global so Orders + Invoices (and any future module that touches uploads)
 * can `inject StorageService` without re-importing this module.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
