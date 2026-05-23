import type { Session } from '@/lib/session';

/**
 * Per-role dashboard landing content. The surrounding chrome (nav + sign-out)
 * is provided by the role area's layout (`AreaShell`).
 */
export function RoleDashboard({ area, session }: { area: string; session: Session }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
        {area} · Dashboard
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-100">Welcome, {session.name}</h1>

      <dl className="mt-6 grid grid-cols-[6rem_1fr] gap-y-2 text-slate-300">
        <dt className="text-slate-500">Role</dt>
        <dd>
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-sm">{session.role}</span>
        </dd>
        <dt className="text-slate-500">Email</dt>
        <dd>{session.email}</dd>
        <dt className="text-slate-500">ID</dt>
        <dd className="font-mono text-xs text-slate-400">{session.id}</dd>
      </dl>

      <p className="mt-8 text-sm text-slate-500">
        {area === 'Client'
          ? 'Your orders and leads dashboard arrives in a later phase.'
          : 'Use the navigation above to manage staff, clients, campaigns and more.'}
      </p>
    </div>
  );
}
