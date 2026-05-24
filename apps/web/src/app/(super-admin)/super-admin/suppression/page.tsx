import { redirect } from 'next/navigation';
import { SuppressionScreen } from '@/components/screens/SuppressionScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <SuppressionScreen />;
}
