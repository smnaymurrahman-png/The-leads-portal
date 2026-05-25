import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SidebarShell } from '@/components/SidebarShell';
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
      areaKey="super-admin"
      profileHref="/super-admin/profile"
      session={session}
    >
      {children}
    </SidebarShell>
  );
}
