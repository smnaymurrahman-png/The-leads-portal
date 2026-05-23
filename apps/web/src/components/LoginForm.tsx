'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

/** Role → dashboard path. Kept local so this Client Component never imports
 *  the server-only auth lib (which would leak `jose` / JWT_SECRET handling). */
const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/super-admin',
  ADMIN: '/admin',
  AGENT: '/agent',
  CLIENT: '/client',
};

const fieldClass =
  'mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 ' +
  'text-slate-100 outline-none focus:border-blue-500';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError('Invalid email or password.');
        return;
      }
      const { role } = (await res.json()) as { role: string };
      router.replace(ROLE_HOME[role] ?? '/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-slate-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-slate-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
