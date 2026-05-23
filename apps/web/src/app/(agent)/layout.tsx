import type { ReactNode } from 'react';
import { AreaShell } from '@/components/AreaShell';

/** Layout for the Agent area — agents manage their own clients. */
export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <AreaShell
      area="Agent"
      links={[
        { href: '/agent', label: 'Dashboard' },
        { href: '/agent/clients', label: 'My Clients' },
        { href: '/agent/campaigns', label: 'Campaigns' },
        { href: '/agent/landing-pages', label: 'Landing Pages' },
        { href: '/agent/orders', label: 'Orders' },
        { href: '/agent/replacements', label: 'Replacements' },
      ]}
    >
      {children}
    </AreaShell>
  );
}
