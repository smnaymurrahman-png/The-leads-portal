'use client';

import { type FormEvent, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { apiSend } from '@/lib/proxy-client';
import type { Session } from '@/lib/session';

/** Self-service profile + password change. */
export function ProfileScreen({ session }: { session: Session }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (next !== confirm) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await apiSend('POST', 'auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      toast.success('Password updated. Use the new one next time you sign in.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Account details and the credentials you use to sign in."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>What we know about your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Name" value={session.name} />
            <Row label="Email" value={session.email} />
            <Row
              label="Role"
              value={
                <Badge variant={session.role === 'CLIENT' ? 'secondary' : 'default'}>
                  {session.role.replace('_', ' ').toLowerCase()}
                </Badge>
              }
            />
            <Row
              label="Account type"
              value={
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  {session.kind === 'USER' ? 'Staff' : 'Client (buyer)'}
                </span>
              }
            />
            <Row
              label="ID"
              value={<code className="text-xs text-muted-foreground">{session.id}</code>}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              We require your current password — a hijacked browser session alone can't rotate
              your credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="next">New password</Label>
                  <Input
                    id="next"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <Button type="submit" disabled={saving || !current || !next || !confirm}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  {saving ? 'Updating…' : 'Update password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}
