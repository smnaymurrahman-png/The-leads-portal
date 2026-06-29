import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import {
  Banknote,
  BarChart3,
  DollarSign,
  FlaskConical,
  Home,
  LayoutDashboard,
  RefreshCw,
  ShoppingCart,
  Sun,
  Ticket,
  Zap,
} from 'lucide-react';
import type { NavSection } from '@/components/nav-config';
import { SidebarShell } from '@/components/SidebarShell';
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/session';

type LeadType = 'SOLAR' | 'SWEEPSTAKES' | 'PAYDAY' | 'HOMEOWNER';

interface ClientProfile {
  targeted_lead_type?: LeadType | null;
}

const LEAD_NAV: Record<LeadType, { label: string; href: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = {
  SOLAR:       { label: 'Solar Leads',       href: '/client/leads/solar',       icon: Sun },
  SWEEPSTAKES: { label: 'Sweepstakes Leads', href: '/client/leads/sweepstakes', icon: Ticket },
  PAYDAY:      { label: 'Payday Leads',      href: '/client/leads/payday',      icon: Banknote },
  HOMEOWNER:   { label: 'Homeowner Leads',   href: '/client/leads/homeowner',   icon: Home },
};

function buildClientNav(targetedLeadType?: LeadType | null): NavSection[] {
  const leadItem = targetedLeadType
    ? LEAD_NAV[targetedLeadType]
    : null;

  return [
    {
      label: 'Overview',
      items: [{ href: '/client', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'Buying',
      items: [
        { href: '/client/orders', label: 'Orders', icon: ShoppingCart },
        leadItem
          ? { href: leadItem.href, label: leadItem.label, icon: leadItem.icon }
          : { href: '/client/leads', label: 'My Leads', icon: Zap },
        { href: '/client/replacements', label: 'Replacements', icon: RefreshCw },
        { href: '/client/samples', label: 'Samples', icon: FlaskConical },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/client/billing', label: 'Billing', icon: DollarSign },
        { href: '/client/reports', label: 'Reports', icon: BarChart3 },
      ],
    },
  ];
}

/** Layout for the Client area — nav is filtered to the client's chosen lead type. */
export default async function ClientLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const profile = await serverApiGet<ClientProfile>('auth/me/profile');
  const navSections = buildClientNav(profile?.targeted_lead_type ?? null);

  return (
    <SidebarShell
      area="Client"
      areaKey="client"
      navSections={navSections}
      profileHref="/client/profile"
      session={session}
    >
      {children}
    </SidebarShell>
  );
}
