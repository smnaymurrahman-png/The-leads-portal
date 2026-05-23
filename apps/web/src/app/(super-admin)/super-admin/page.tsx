import { redirect } from 'next/navigation';
import { RoleDashboard } from '@/components/RoleDashboard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SuperAdminPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <RoleDashboard area="Super Admin" session={session} />;
}
