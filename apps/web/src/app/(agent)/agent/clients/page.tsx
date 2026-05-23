import { redirect } from 'next/navigation';
import { ClientsScreen } from '@/components/screens/ClientsScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <ClientsScreen role={session.role} />;
}
