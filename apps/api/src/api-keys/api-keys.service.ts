import { Injectable, NotFoundException } from '@nestjs/common';
import { type ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from './crypto.service';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';

/** Third-party API keys, encrypted at rest. The plaintext is never returned. */
@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async create(dto: CreateApiKeyDto) {
    const key = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        key_prefix: dto.value.slice(0, 4),
        encrypted_value: this.crypto.encrypt(dto.value),
      },
    });
    return this.mask(key);
  }

  async list() {
    const keys = await this.prisma.apiKey.findMany({
      where: { revoked_at: null },
      orderBy: { created_at: 'desc' },
    });
    return keys.map((key) => this.mask(key));
  }

  async revoke(id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    await this.prisma.apiKey.update({ where: { id }, data: { revoked_at: new Date() } });
    return { id, revoked: true };
  }

  /**
   * Internal — decrypts a stored key for server-side use. Deliberately not
   * exposed over HTTP.
   */
  async getSecret(id: string): Promise<string> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    return this.crypto.decrypt(key.encrypted_value);
  }

  /** Strips the encrypted value — only safe metadata leaves the service. */
  private mask(key: ApiKey) {
    return {
      id: key.id,
      name: key.name,
      key_prefix: key.key_prefix,
      last_used_at: key.last_used_at,
      created_at: key.created_at,
    };
  }
}
