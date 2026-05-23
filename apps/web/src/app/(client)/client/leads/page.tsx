import { redirect } from 'next/navigation';
import { LiveLeadsScreen } from '@/components/screens/LiveLeadsScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <LiveLeadsScreen />;
}
