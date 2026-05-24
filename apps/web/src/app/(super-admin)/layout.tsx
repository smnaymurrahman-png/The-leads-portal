import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SidebarShell } from '@/components/SidebarShell';
import { SUPER_ADMIN_NAV } from '@/components/nav-config';
import { getSession } from '@/lib/session';

/** Layout for the Super Admin area — full management navigation. */
export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return (
    <SidebarShell
      area="Super Admin"
      profileHref="/super-admin/profile"
      navSections={SUPER_ADMIN_NAV}
      session={session}
    >
      {children}
    </SidebarShell>
  );
}
