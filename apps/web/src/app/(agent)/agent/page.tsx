import { redirect } from 'next/navigation';
import { AgentDashboard } from '@/components/dashboard/AgentDashboard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <AgentDashboard session={session} />;
}
