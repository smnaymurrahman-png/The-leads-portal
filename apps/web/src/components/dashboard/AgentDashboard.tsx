import { Building2, RefreshCw, ShoppingCart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from './PageHeader';
import { RecentOrdersCard } from './RecentOrdersCard';
import { StatCard } from './StatCard';
import { serverApiGet, type Session } from '@/lib/session';

interface AgentSummary {
  scope: 'AGENT';
  totals: { myClients: number };
}

interface OrderRow {
  id: string;
  status: string;
  total_amount: string | number;
}

interface ReplacementRow {
  id: string;
  status: string;
}

/** Agent landing page — book of business at a glance. */
export async function AgentDashboard({ session }: { session: Session }) {
  const [summary, orders, replacements] = await Promise.all([
    serverApiGet<AgentSummary>('agent/summary'),
    serverApiGet<OrderRow[]>('orders'),
    serverApiGet<ReplacementRow[]>('replacements'),
  ]);

  const activeOrders = (orders ?? []).filter((o) =>
    ['ACTIVE', 'FULFILLING', 'PENDING_APPROVAL'].includes(o.status),
  ).length;
  const pendingReplacements = (replacements ?? []).filter((r) => r.status === 'REQUESTED').length;

  return (
    <div>
      <PageHeader
        eyebrow="Agent"
        title={`Hi ${session.name.split(' ')[0]}.`}
        description="Your book of clients, the orders they have running, and what needs your attention."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="My clients"
          value={summary?.totals.myClients ?? 0}
          hint="Accounts you own."
          icon={Building2}
          iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
        />
        <StatCard
          label="Active orders"
          value={activeOrders}
          hint={`${(orders ?? []).length} orders in total.`}
          icon={ShoppingCart}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          label="Replacements waiting"
          value={pendingReplacements}
          hint="Client-requested swaps awaiting review."
          icon={RefreshCw}
          iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrdersCard ordersHref="/agent/orders" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>Jump straight to your most-used screens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <QuickLink href="/agent/clients" label="Manage my clients" />
            <QuickLink href="/agent/campaigns" label="Configure campaigns" />
            <QuickLink href="/agent/landing-pages" label="Edit landing pages" />
            <QuickLink href="/agent/replacements" label="Review replacements" />
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
