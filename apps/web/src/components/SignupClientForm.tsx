'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LEAD_TYPES = [
  { value: 'SOLAR',       label: 'Solar' },
  { value: 'SWEEPSTAKES', label: 'Sweepstakes' },
  { value: 'PAYDAY',      label: 'Payday' },
  { value: 'HOMEOWNER',   label: 'Homeowner' },
] as const;

export function SignupClientForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [leadType, setLeadType] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!leadType) {
      toast.error('Please select a targeted lead type');
      return;
    }
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    const confirm = fd.get('confirm_password') as string;
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/proxy/auth/signup/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:          fd.get('full_name'),
          email:              fd.get('email'),
          password,
          whatsapp:           fd.get('whatsapp') || undefined,
          targeted_lead_type: leadType,
          business_name:      fd.get('business_name') || undefined,
          address:            fd.get('address') || undefined,
          agent_id:           fd.get('agent_id'),
        }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? 'Sign up failed');
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
          <p className="font-semibold text-foreground">Account created!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your agent will review and approve your request. You will be notified once active.
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
        <Input id="full_name" name="full_name" required placeholder="Jane Smith" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" name="email" type="email" required placeholder="jane@example.com" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="whatsapp">WhatsApp Number <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="whatsapp" name="whatsapp" type="tel" placeholder="+1 555 000 0000" />
      </div>

      <div className="space-y-1.5">
        <Label>Targeted Lead Type</Label>
        <Select value={leadType} onValueChange={(v) => setLeadType(v ?? '')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select lead type" />
          </SelectTrigger>
          <SelectContent>
            {LEAD_TYPES.map((lt) => (
              <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business_name">Business Name <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="business_name" name="business_name" placeholder="Acme Corp" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Business Address <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="address" name="address" placeholder="123 Main St, City, State" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent_id">Agent ID</Label>
        <Input id="agent_id" name="agent_id" required placeholder="Provided by your agent" />
        <p className="text-xs text-muted-foreground">You cannot create an account without a valid Agent ID.</p>
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
        Create Account
      </Button>
    </form>
  );
}
