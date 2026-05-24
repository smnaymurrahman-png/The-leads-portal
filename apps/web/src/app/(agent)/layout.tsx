import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SidebarShell } from '@/components/SidebarShell';
import { AGENT_NAV } from '@/components/nav-config';
import { getSession } from '@/lib/session';

/** Layout for the Agent area — agents manage their own clients. */
export default async function AgentLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return (
    <SidebarShell area="Agent" navSections={AGENT_NAV} session={session}>
      {children}
    </SidebarShell>
  );
}
