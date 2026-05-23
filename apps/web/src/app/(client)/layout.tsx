import type { ReactNode } from 'react';
import { AreaShell } from '@/components/AreaShell';

/** Layout for the Client area. */
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AreaShell
      area="Client"
      links={[
        { href: '/client', label: 'Dashboard' },
        { href: '/client/orders', label: 'Orders' },
        { href: '/client/leads', label: 'Live Leads' },
        { href: '/client/replacements', label: 'Replacements' },
      ]}
    >
      {children}
    </AreaShell>
  );
}
