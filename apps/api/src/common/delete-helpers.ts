import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Wrap a Prisma delete so a foreign-key violation surfaces as a friendly
 * 409 instead of a server crash. Suggests the safe alternative
 * (deactivate via status change) so the caller knows what to do next.
 */
export async function deleteOrConflict<T>(
  doDelete: () => Promise<T>,
  entityName: string,
): Promise<T> {
  try {
    return await doDelete();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException(
        `Can't delete this ${entityName} — other records still reference it. Deactivate it instead.`,
      );
    }
    throw error;
  }
}
