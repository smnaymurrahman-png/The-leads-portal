import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SidebarShell } from '@/components/SidebarShell';
import { getSession } from '@/lib/session';

/** Layout for the Client area. */
export default async function ClientLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return (
    <SidebarShell area="Client" areaKey="client" profileHref="/client/profile" session={session}>
      {children}
    </SidebarShell>
  );
}
