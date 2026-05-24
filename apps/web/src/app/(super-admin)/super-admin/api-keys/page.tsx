import { redirect } from 'next/navigation';
import { ApiKeysScreen } from '@/components/screens/ApiKeysScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <ApiKeysScreen />;
}
