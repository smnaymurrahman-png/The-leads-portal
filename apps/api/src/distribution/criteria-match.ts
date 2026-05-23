import type { Lead } from '@prisma/client';

/** Geo fields on a lead that an order's criteria can target. */
const GEO_FIELDS = ['country', 'state', 'zip'] as const;

/** A constraint value matches when it equals the actual value, or — if it is
 *  an array — when any element matches. Strings compare case-insensitively. */
function valueMatches(constraint: unknown, actual: unknown): boolean {
  if (Array.isArray(constraint)) {
    return constraint.some((candidate) => valueMatches(candidate, actual));
  }
  if (constraint === null || constraint === undefined) {
    return true;
  }
  if (actual === null || actual === undefined) {
    return false;
  }
  if (typeof constraint === 'string' && typeof actual === 'string') {
    return constraint.trim().toLowerCase() === actual.trim().toLowerCase();
  }
  return constraint === actual;
}

/**
 * True when an order's `criteria` matches the lead.
 *
 * Criteria shape (every part optional):
 *   { geo: { country?, state?, zip? }, qualification: { <key>: value | value[] } }
 *
 * A constraint value may be a single value or an array (the lead matches any).
 * Empty or absent criteria matches every lead of the right lead type.
 */
export function matchesCriteria(criteria: unknown, lead: Lead): boolean {
  if (!criteria || typeof criteria !== 'object') {
    return true;
  }
  const root = criteria as Record<string, unknown>;

  const geo =
    root.geo && typeof root.geo === 'object' ? (root.geo as Record<string, unknown>) : {};
  for (const field of GEO_FIELDS) {
    if (field in geo && !valueMatches(geo[field], lead[field])) {
      return false;
    }
  }

  const qualification =
    root.qualification && typeof root.qualification === 'object'
      ? (root.qualification as Record<string, unknown>)
      : {};
  const leadQualification =
    lead.qualification && typeof lead.qualification === 'object'
      ? (lead.qualification as Record<string, unknown>)
      : {};
  for (const [key, constraint] of Object.entries(qualification)) {
    if (!valueMatches(constraint, leadQualification[key])) {
      return false;
    }
  }

  return true;
}
