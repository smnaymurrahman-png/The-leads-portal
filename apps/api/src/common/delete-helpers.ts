import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const logger = new Logger('deleteOrConflict');

/**
 * Prisma error codes that mean "this row is still referenced and can't be
 * deleted": P2003 = DB-level foreign-key violation; P2014 = the query engine
 * refusing because a *required* relation (e.g. Client.agent_id → User) would
 * be orphaned. Both must map to a 409, not a 500.
 */
const REFERENCED_CODES: ReadonlySet<string> = new Set(['P2003', 'P2014']);

/** The friendly 409 we return whenever a row is still referenced. */
function conflict(entityName: string): ConflictException {
  return new ConflictException(
    `Can't delete this ${entityName} — other records still reference it. Deactivate it instead.`,
  );
}

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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`${entityName} not found`);
      }
      if (REFERENCED_CODES.has(error.code)) {
        throw conflict(entityName);
      }
      // Any other known Prisma error on a delete is still almost certainly a
      // constraint problem — log the code and return a 409 rather than a 500.
      logger.warn(`delete ${entityName} failed with Prisma ${error.code}: ${error.message}`);
      throw conflict(entityName);
    }
    // Required relations default to ON DELETE RESTRICT. Postgres raises that as
    // code 23001, which Prisma does NOT map to P2003 — it comes back as an
    // UnknownRequestError. Detect the FK message and treat it as a conflict.
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      /foreign key constraint/i.test(error.message)
    ) {
      throw conflict(entityName);
    }
    // Truly unexpected — log the type so it shows up in the server logs.
    logger.error(
      `delete ${entityName} failed: ${error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error)}`,
    );
    throw error;
  }
}
