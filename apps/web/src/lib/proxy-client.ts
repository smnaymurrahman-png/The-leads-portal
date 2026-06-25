/**
 * Client-side helpers for talking to the API through the local `/api/proxy`
 * route. Safe to import from Client Components — no secrets, no server-only
 * modules.
 */

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown };
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.message === 'string') return data.message;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

/** GET `/api/proxy/<path>` and parse JSON. Throws on a non-2xx response. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return (await res.json()) as T;
}

/** Send a mutating request through the proxy. Throws on a non-2xx response. */
export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * POST multipart form data (e.g. a file upload) through the proxy. The
 * `Content-Type` (with its boundary) is set by the browser — do not set it
 * manually. Throws on a non-2xx response.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return (await res.json()) as T;
}
