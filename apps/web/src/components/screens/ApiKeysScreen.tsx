'use client';

import { useState } from 'react';
import { KeyRound, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { clean, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

/**
 * Vault for third-party API secrets. SUPER_ADMIN only. The full value is
 * encrypted server-side and is never returned over HTTP — only the prefix
 * and a "last used" timestamp surface in the UI.
 */
export function ApiKeysScreen() {
  const { data: keys, loading, error, reload } = useResource<ApiKeyRow>('api-keys');
  const [confirmRevoke, setConfirmRevoke] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    await apiSend(
      'POST',
      'api-keys',
      clean({ name: str(fd.get('name')), value: str(fd.get('value')) }),
    );
    await reload();
    toast.success('API key added to the vault');
  }

  async function revoke(): Promise<void> {
    if (!confirmRevoke) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/proxy/api-keys/${confirmRevoke.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
      toast.success(`Revoked "${confirmRevoke.name}"`);
      setConfirmRevoke(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Vault"
        title="API keys"
        description="Third-party secrets used by the server, encrypted at rest. The full value is never returned by the API once saved."
        actions={
          <FormDialog
            triggerLabel="Add API key"
            title="Store a third-party API key"
            description="The value is AES-256-GCM encrypted on save. We only show the first 4 characters afterwards."
            submitLabel="Save key"
            onSubmit={onCreate}
          >
            <div className="space-y-3">
              <Field label="Label" hint="how staff will recognize it">
                <Input name="name" placeholder="e.g. SendGrid Production" required />
              </Field>
              <Field label="Secret value" hint="paste once — we encrypt + forget">
                <Input
                  name="value"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </Field>
            </div>
          </FormDialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={5} rows={4} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No keys stored yet"
              description="Add a key to start. Keys are encrypted and only the prefix is visible after save."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setConfirmRevoke(k)}
                      >
                        <Trash2 className="size-3.5" />
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmRevoke !== null} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this key?</DialogTitle>
            <DialogDescription>
              {confirmRevoke && (
                <>
                  <span className="font-medium text-foreground">{confirmRevoke.name}</span> will
                  stop working immediately for any integration that loads it. This action cannot
                  be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={revoke} disabled={revoking}>
              {revoking ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Revoke key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
