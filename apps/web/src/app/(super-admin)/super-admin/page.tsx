import { redirect } from 'next/navigation';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SuperAdminPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <SuperAdminDashboard session={session} />;
}
