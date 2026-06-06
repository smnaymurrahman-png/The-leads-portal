import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Prisma error codes that mean "this row is still referenced and can't be
 * deleted": P2003 = DB-level foreign-key violation; P2014 = the query engine
 * refusing because a *required* relation (e.g. Client.agent_id → User) would
 * be orphaned. Both must map to a 409, not a 500.
 */
const REFERENCED_CODES: ReadonlySet<string> = new Set(['P2003', 'P2014']);

/**
 * Wrap a Prisma delete so a constraint violation surfaces as a friendly
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
      REFERENCED_CODES.has(error.code)
    ) {
      throw new ConflictException(
        `Can't delete this ${entityName} — other records still reference it. Deactivate it instead.`,
      );
    }
    throw error;
  }
}
