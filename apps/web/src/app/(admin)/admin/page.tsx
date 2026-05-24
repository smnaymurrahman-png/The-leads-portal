import { redirect } from 'next/navigation';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  // Admin and super-admin share the same reports endpoints, so the dashboard
  // is the same body — only the deep links change.
  return (
    <SuperAdminDashboard session={session} area="Admin" ordersHref="/admin/orders" />
  );
}
