import type { ReactNode } from 'react';
import { AreaShell } from '@/components/AreaShell';

/** Layout for the Admin area. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AreaShell
      area="Admin"
      links={[
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/clients', label: 'Clients' },
        { href: '/admin/campaigns', label: 'Campaigns' },
        { href: '/admin/landing-pages', label: 'Landing Pages' },
        { href: '/admin/orders', label: 'Orders' },
        { href: '/admin/replacements', label: 'Replacements' },
        { href: '/admin/reports', label: 'Reports' },
      ]}
    >
      {children}
    </AreaShell>
  );
}
