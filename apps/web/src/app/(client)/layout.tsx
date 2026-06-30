import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SidebarShell } from '@/components/SidebarShell';
import { getSession, serverApiGet } from '@/lib/session';

interface ClientProfile {
  targeted_lead_type?: string | null;
}

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const profile = await serverApiGet<ClientProfile>('auth/me/profile');

  return (
    <SidebarShell
      area="Client"
      areaKey="client"
      clientLeadType={profile?.targeted_lead_type ?? null}
      profileHref="/client/profile"
      session={session}
    >
      {children}
    </SidebarShell>
  );
}
