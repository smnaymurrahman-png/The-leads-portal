import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { CryptoService } from './crypto.service';

/** Encrypted-at-rest storage for third-party API keys. */
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, CryptoService],
  exports: [ApiKeysService, CryptoService],
})
export class ApiKeysModule {}
