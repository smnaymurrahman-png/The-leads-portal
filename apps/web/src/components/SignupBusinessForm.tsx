'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SignupBusinessForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    const confirm = fd.get('confirm_password') as string;
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/proxy/auth/signup/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:     fd.get('full_name'),
          work_email:    fd.get('work_email'),
          phone:         fd.get('phone'),
          whatsapp:      fd.get('whatsapp') || undefined,
          business_name: fd.get('business_name') || undefined,
          password,
        }),
      });
      const data = await res.json() as { message?: string; statusCode?: number };
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Sign up failed');
        return;
      }
      setDone(true);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2 className="size-12 text-emerald-500" />
        <div>
          <p className="font-semibold text-foreground">Application submitted!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            An admin will review your account. You will be notified once approved.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full Name</Label>
        <Input id="full_name" name="full_name" required placeholder="John Smith" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="work_email">Email Address</Label>
        <Input id="work_email" name="work_email" type="email" required placeholder="john@example.com" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone Number</Label>
        <Input id="phone" name="phone" type="tel" required placeholder="+1 555 000 0000" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="whatsapp">WhatsApp Number <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="whatsapp" name="whatsapp" type="tel" placeholder="+1 555 000 0000" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business_name">Business Name <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="business_name" name="business_name" placeholder="Acme Corp" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} placeholder="Min. 8 characters" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm_password">Confirm Password</Label>
        <Input id="confirm_password" name="confirm_password" type="password" required placeholder="Repeat password" />
      </div>

      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        Submit Application
      </Button>
    </form>
  );
}
