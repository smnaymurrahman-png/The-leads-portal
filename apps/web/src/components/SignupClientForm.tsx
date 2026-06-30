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
  { value: 'SOLAR',       label: 'Solar Leads' },
  { value: 'SWEEPSTAKES', label: 'Sweepstakes Leads' },
  { value: 'PAYDAY',      label: 'Payday Leads' },
  { value: 'HOMEOWNER',   label: 'Homeowner Leads' },
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3 mt-1">
      {children}
    </p>
  );
}

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
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
          <CheckCircle2 className="size-8 text-emerald-500" />
        </div>
        <div>
          <p className="text-base font-semibold">Account created!</p>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
            Your agent will review and approve your request. You&apos;ll be notified once active.
          </p>
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => router.push('/login')}>
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {/* Personal */}
      <div>
        <SectionLabel>Personal Info</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" name="full_name" required placeholder="Jane Smith" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" name="email" type="email" required placeholder="jane@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">
              WhatsApp <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="whatsapp" name="whatsapp" type="tel" placeholder="+1 555 000 0000" />
          </div>
        </div>
      </div>

      {/* Business */}
      <div className="border-t pt-5">
        <SectionLabel>Business & Leads</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <Label htmlFor="business_name">
              Business Name <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="business_name" name="business_name" placeholder="Acme Corp" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">
              Business Address <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="address" name="address" placeholder="123 Main St, City, State" />
          </div>
        </div>
      </div>

      {/* Agent */}
      <div className="border-t pt-5">
        <SectionLabel>Agent Link</SectionLabel>
        <div className="space-y-1.5">
          <Label htmlFor="agent_id">Agent ID</Label>
          <Input id="agent_id" name="agent_id" required placeholder="Provided by your agent" />
          <p className="text-xs text-muted-foreground">
            You cannot create an account without a valid Agent ID.
          </p>
        </div>
      </div>

      {/* Security */}
      <div className="border-t pt-5">
        <SectionLabel>Security</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={8} placeholder="Min. 8 characters" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm Password</Label>
            <Input id="confirm_password" name="confirm_password" type="password" required placeholder="Repeat password" />
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full h-10" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : 'Create Account'}
      </Button>
    </form>
  );
}
