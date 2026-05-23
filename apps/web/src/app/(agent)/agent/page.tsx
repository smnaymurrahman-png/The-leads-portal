import { redirect } from 'next/navigation';
import { RoleDashboard } from '@/components/RoleDashboard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <RoleDashboard area="Agent" session={session} />;
}
