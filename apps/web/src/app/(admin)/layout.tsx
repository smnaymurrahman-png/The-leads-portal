import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SidebarShell } from '@/components/SidebarShell';
import { getSession } from '@/lib/session';

/** Layout for the Admin area. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return (
    <SidebarShell area="Admin" areaKey="admin" profileHref="/admin/profile" session={session}>
      {children}
    </SidebarShell>
  );
}
