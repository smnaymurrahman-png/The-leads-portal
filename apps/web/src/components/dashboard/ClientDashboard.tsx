import { RefreshCw, ShoppingCart, Zap } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from './PageHeader';
import { StatCard } from './StatCard';
import { serverApiGet, type Session } from '@/lib/session';

interface ClientSummary {
  scope: 'CLIENT';
  totals: { myOrders: number };
}

interface OrderRow {
  id: string;
  public_order_id: string;
  status: string;
  total_amount: string | number;
  filled_count?: number;
  quantity?: number;
}

interface ReplacementRow {
  id: string;
  status: string;
}

const money = (n: string | number): string =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Client landing page — what you bought, what's being delivered, what's pending. */
export async function ClientDashboard({ session }: { session: Session }) {
  const [summary, orders, replacements] = await Promise.all([
    serverApiGet<ClientSummary>('client/summary'),
    serverApiGet<OrderRow[]>('orders'),
    serverApiGet<ReplacementRow[]>('replacements'),
  ]);

  const activeOrders = (orders ?? []).filter((o) =>
    ['ACTIVE', 'FULFILLING'].includes(o.status),
  );
  const totalLeadsBought = (orders ?? []).reduce((sum, o) => sum + (o.quantity ?? 0), 0);
  const totalLeadsDelivered = (orders ?? []).reduce((sum, o) => sum + (o.filled_count ?? 0), 0);
  const pendingReplacements = (replacements ?? []).filter((r) => r.status === 'REQUESTED').length;

  return (
    <div>
      <PageHeader
        eyebrow="Client"
        title={`Welcome, ${session.name.split(' ')[0]}.`}
        description="Track every order and see leads land in real time."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active orders"
          value={activeOrders.length}
          hint={`${summary?.totals.myOrders ?? 0} orders in total.`}
          icon={ShoppingCart}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          label="Leads delivered"
          value={totalLeadsDelivered}
          hint={`${totalLeadsBought.toLocaleString()} purchased across all orders.`}
          icon={Zap}
          iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        />
        <StatCard
          label="Replacements pending"
          value={pendingReplacements}
          hint="Awaiting our review."
          icon={RefreshCw}
          iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active orders</CardTitle>
            <CardDescription>Orders currently fulfilling against the live pool.</CardDescription>
          </CardHeader>
          <CardContent>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active orders.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeOrders.map((order) => {
                  const filled = order.filled_count ?? 0;
                  const qty = order.quantity ?? 0;
                  const pct = qty > 0 ? Math.round((filled / qty) * 100) : 0;
                  return (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {order.public_order_id}
                        </p>
                        <p className="font-medium">{money(order.total_amount)}</p>
                      </div>
                      <div className="flex w-1/2 items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${pct}%` }}
                            aria-label={`${pct}% delivered`}
                          />
                        </div>
                        <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                          {filled} / {qty}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What's next</CardTitle>
            <CardDescription>Common things you might want to do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <QuickLink href="/client/leads" label="Watch leads land in real time" />
            <QuickLink href="/client/orders" label="Manage your orders" />
            <QuickLink href="/client/replacements" label="Request a replacement" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      {label}
    </a>
  );
}
