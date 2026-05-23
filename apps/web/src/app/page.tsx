import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <p style={{ color: 'var(--muted)', letterSpacing: '0.08em', fontSize: 13 }}>
        PHASE 1 · SKELETON
      </p>
      <h1 style={{ fontSize: 40, marginTop: 8 }}>Leads Portal</h1>
      <p style={{ color: 'var(--muted)', marginTop: 8 }}>
        Multi-vertical lead-generation management and live distribution platform.
      </p>

      <div
        style={{
          marginTop: 32,
          padding: '1.25rem 1.5rem',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <p style={{ margin: 0 }}>
          The monorepo skeleton is running. Role-based dashboards arrive in Phase 7.
        </p>
        <p style={{ margin: '12px 0 0' }}>
          <Link href="/health">Check system health →</Link>
        </p>
      </div>
    </main>
  );
}
