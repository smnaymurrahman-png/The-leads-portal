/** Small helpers for turning `FormData` values into a JSON payload. */

/** Trimmed string ('' when absent). */
export function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Trimmed string, or undefined when empty. */
export function opt(value: FormDataEntryValue | null): string | undefined {
  const s = str(value);
  return s.length > 0 ? s : undefined;
}

/** Number, or undefined when empty. */
export function num(value: FormDataEntryValue | null): number | undefined {
  const s = str(value);
  return s.length > 0 ? Number(s) : undefined;
}

/** Drops keys whose value is undefined or '' — keeps payloads minimal. */
export function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''),
  ) as Partial<T>;
}
