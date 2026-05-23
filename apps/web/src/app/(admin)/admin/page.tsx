import { redirect } from 'next/navigation';
import { RoleDashboard } from '@/components/RoleDashboard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <RoleDashboard area="Admin" session={session} />;
}
