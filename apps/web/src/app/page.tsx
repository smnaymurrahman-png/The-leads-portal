import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" alt="Leads Portal icon" width={36} height={36} />
          <Image src="/logo.png" alt="Leads Portal" height={32} width={160} className="object-contain" />
        </div>
        <Link
          href="/login"
          className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Log in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-6xl mx-auto w-full">
        <div className="max-w-2xl">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary mb-4 px-3 py-1 rounded-full bg-accent">
            Lead Distribution Platform
          </span>
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-5">
            Manage and distribute<br />leads at scale
          </h1>
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            A multi-vertical platform for capturing, validating, and delivering
            high-quality leads across Solar, Payday, Sweepstakes, and Homeowner verticals.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-lg"
          >
            Log in to your account
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-20 w-full max-w-3xl">
          <div className="rounded-xl border border-border bg-card p-5 text-left">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Role-based access</h3>
            <p className="text-sm text-muted-foreground">Separate dashboards for admins, agents, and clients — each sees exactly what they need.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-left">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Live distribution</h3>
            <p className="text-sm text-muted-foreground">Auto-matching engine delivers leads to active orders in real time via Socket.IO.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-left">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Full audit trail</h3>
            <p className="text-sm text-muted-foreground">Every sensitive action — PII reveal, payment approval, assignment — is logged and auditable.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-5 px-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Leads Portal. All rights reserved.
      </footer>
    </div>
  );
}
