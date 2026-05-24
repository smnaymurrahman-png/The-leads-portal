import { redirect } from 'next/navigation';
import { ClientDashboard } from '@/components/dashboard/ClientDashboard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ClientPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <ClientDashboard session={session} />;
}
