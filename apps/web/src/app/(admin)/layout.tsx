import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SidebarShell } from '@/components/SidebarShell';
import { ADMIN_NAV } from '@/components/nav-config';
import { getSession } from '@/lib/session';

/** Layout for the Admin area. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return (
    <SidebarShell
      area="Admin"
      profileHref="/admin/profile"
      navSections={ADMIN_NAV}
      session={session}
    >
      {children}
    </SidebarShell>
  );
}
