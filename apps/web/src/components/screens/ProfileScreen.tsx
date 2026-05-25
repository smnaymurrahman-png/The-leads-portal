'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Save, ShieldCheck } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { apiGet, apiSend } from '@/lib/proxy-client';
import type { Session } from '@/lib/session';

interface FullProfileUser {
  kind: 'USER';
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  whatsapp: string | null;
  designation: string | null;
  employee_id: string | null;
  linkedin_url: string | null;
}

interface FullProfileClient {
  kind: 'CLIENT';
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  whatsapp: string | null;
  business_name: string | null;
  address: string | null;
}

type FullProfile = FullProfileUser | FullProfileClient;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  PENDING: 'outline',
  SUSPENDED: 'destructive',
  INACTIVE: 'secondary',
};

/** Self-service profile editor + password change. */
export function ProfileScreen({ session }: { session: Session }) {
  const router = useRouter();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state — kept separate so a profile save doesn't reset it.
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setProfile(await apiGet<FullProfile>('auth/me/profile'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      }
    })();
  }, []);

  async function onProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!profile) return;
    const fd = new FormData(event.currentTarget);
    const body =
      profile.kind === 'USER'
        ? {
            full_name: String(fd.get('full_name') ?? '').trim() || undefined,
            phone: String(fd.get('phone') ?? '').trim() || undefined,
            whatsapp: String(fd.get('whatsapp') ?? '').trim() || undefined,
            designation: String(fd.get('designation') ?? '').trim() || undefined,
            employee_id: String(fd.get('employee_id') ?? '').trim() || undefined,
            linkedin_url: String(fd.get('linkedin_url') ?? '').trim() || undefined,
          }
        : {
            full_name: String(fd.get('full_name') ?? '').trim() || undefined,
            phone: String(fd.get('phone') ?? '').trim() || undefined,
            whatsapp: String(fd.get('whatsapp') ?? '').trim() || undefined,
            business_name: String(fd.get('business_name') ?? '').trim() || undefined,
            address: String(fd.get('address') ?? '').trim() || undefined,
          };

    setSavingProfile(true);
    try {
      await apiSend('PATCH', 'auth/me', body);
      // Refetch so the form reflects what the server actually persisted,
      // and bounce the router so the sidebar footer name updates too.
      setProfile(await apiGet<FullProfile>('auth/me/profile'));
      router.refresh();
      toast.success('Profile saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (next !== confirm) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    setSavingPassword(true);
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
      setSavingPassword(false);
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
        {/* Identity / profile editor — 2 cols wide on desktop. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              Email and role are managed by an administrator — every other field is yours to edit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !profile ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : (
              <form onSubmit={onProfileSubmit} className="space-y-5">
                {/* Read-only metadata strip */}
                <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm sm:grid-cols-2">
                  <ReadOnlyRow label="Email" value={profile.email} />
                  <ReadOnlyRow
                    label="Role"
                    value={
                      <Badge variant={profile.role === 'CLIENT' ? 'secondary' : 'default'}>
                        {profile.role.replace('_', ' ').toLowerCase()}
                      </Badge>
                    }
                  />
                  <ReadOnlyRow
                    label="Account type"
                    value={
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="size-3.5" />
                        {profile.kind === 'USER' ? 'Staff' : 'Client (buyer)'}
                      </span>
                    }
                  />
                  <ReadOnlyRow
                    label="Status"
                    value={
                      <Badge variant={STATUS_VARIANT[profile.status] ?? 'outline'}>
                        {profile.status.toLowerCase()}
                      </Badge>
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      defaultValue={profile.full_name}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      defaultValue={profile.phone ?? ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      name="whatsapp"
                      defaultValue={profile.whatsapp ?? ''}
                    />
                  </div>

                  {profile.kind === 'USER' ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="designation">Designation</Label>
                        <Input
                          id="designation"
                          name="designation"
                          defaultValue={profile.designation ?? ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employee_id">Employee ID</Label>
                        <Input
                          id="employee_id"
                          name="employee_id"
                          defaultValue={profile.employee_id ?? ''}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="linkedin_url">LinkedIn</Label>
                        <Input
                          id="linkedin_url"
                          name="linkedin_url"
                          type="url"
                          placeholder="https://linkedin.com/in/…"
                          defaultValue={profile.linkedin_url ?? ''}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="business_name">Business name</Label>
                        <Input
                          id="business_name"
                          name="business_name"
                          defaultValue={profile.business_name ?? ''}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          name="address"
                          defaultValue={profile.address ?? ''}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {savingProfile ? 'Saving…' : 'Save profile'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Signed in as <span className="font-medium">{session.email}</span>
                  </span>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Password form — narrower. */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Current password required — a hijacked session can't rotate your credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onPasswordSubmit} className="space-y-4">
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
              <div className="border-t border-border pt-4">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={savingPassword || !current || !next || !confirm}
                >
                  {savingPassword ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  {savingPassword ? 'Updating…' : 'Update password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
