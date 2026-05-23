import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm px-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Leads Portal</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">Sign in</h1>
      <p className="mt-1 text-sm text-slate-400">Use a seeded account — staff or client.</p>
      <LoginForm />
    </div>
  );
}
