import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, UserCheck } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="w-full max-w-xl">
      {/* Brand */}
      <div className="mb-8 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Leads Portal" className="h-9 w-auto object-contain" style={{ maxWidth: 220 }} />
      </div>

      {/* Heading */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Get started</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your account type to create a free account.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Business / Agent */}
        <Link href="/signup/business" className="group block">
          <div className="relative h-full overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Building2 className="size-6" />
            </div>
            <h2 className="text-base font-semibold">Business Portal</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              For agents and business owners managing clients, leads, and campaigns.
            </p>
            <ul className="mt-4 space-y-1.5">
              {['Manage client accounts', 'Run lead campaigns', 'Track orders & reports'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-1 text-xs font-medium text-primary">
              Sign up as agent
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Requires admin approval
            </p>
          </div>
        </Link>

        {/* Client */}
        <Link href="/signup/client" className="group block">
          <div className="relative h-full overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <UserCheck className="size-6" />
            </div>
            <h2 className="text-base font-semibold">Client Portal</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              For buyers who want to purchase and manage leads through their agent.
            </p>
            <ul className="mt-4 space-y-1.5">
              {['Browse & buy leads', 'Place and track orders', 'Access your reports'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-1 text-xs font-medium text-primary">
              Sign up as client
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Requires an Agent ID
            </p>
          </div>
        </Link>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
