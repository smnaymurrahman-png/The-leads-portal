import Link from 'next/link';
import { fetchApiHealth } from '@/lib/api';

// Always render fresh — never cache a health snapshot.
export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--ok)',
  degraded: 'var(--warn)',
  error: 'var(--err)',
};

export default async function HealthPage() {
  const health = await fetchApiHealth();
  const color = STATUS_COLOR[health.status] ?? 'var(--muted)';

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <p style={{ margin: 0 }}>
        <Link href="/">← Back</Link>
      </p>
      <h1 style={{ fontSize: 32, marginTop: 16 }}>System Health</h1>

      <div
        style={{
          marginTop: 24,
          padding: '1.5rem',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
            }}
          />
          <strong style={{ fontSize: 18 }}>API: {health.status.toUpperCase()}</strong>
        </div>

        <dl style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
          <dt style={{ color: 'var(--muted)' }}>Service</dt>
          <dd>{health.service}</dd>
          <dt style={{ color: 'var(--muted)' }}>Checked at</dt>
          <dd>{health.timestamp}</dd>
          {health.checks &&
            Object.entries(health.checks).map(([name, result]) => (
              <FragmentRow key={name} name={name} result={result} />
            ))}
        </dl>
      </div>

      <p style={{ color: 'var(--muted)', marginTop: 16, fontSize: 13 }}>
        This page is server-rendered and calls the NestJS API at{' '}
        <code>{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/health</code>.
      </p>
    </main>
  );
}

function FragmentRow({ name, result }: { name: string; result: 'ok' | 'error' }) {
  return (
    <>
      <dt style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{name}</dt>
      <dd style={{ color: result === 'ok' ? 'var(--ok)' : 'var(--err)' }}>{result}</dd>
    </>
  );
}
