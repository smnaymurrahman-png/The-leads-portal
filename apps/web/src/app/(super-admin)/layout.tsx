import type { ReactNode } from 'react';
import { AreaShell } from '@/components/AreaShell';

/** Layout for the Super Admin area — full management navigation. */
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AreaShell
      area="Super Admin"
      links={[
        { href: '/super-admin', label: 'Dashboard' },
        { href: '/super-admin/users', label: 'Users' },
        { href: '/super-admin/clients', label: 'Clients' },
        { href: '/super-admin/campaigns', label: 'Campaigns' },
        { href: '/super-admin/landing-pages', label: 'Landing Pages' },
        { href: '/super-admin/pricing', label: 'Pricing' },
        { href: '/super-admin/orders', label: 'Orders' },
        { href: '/super-admin/replacements', label: 'Replacements' },
        { href: '/super-admin/reports', label: 'Reports' },
        { href: '/super-admin/audit', label: 'Audit' },
      ]}
    >
      {children}
    </AreaShell>
  );
}
