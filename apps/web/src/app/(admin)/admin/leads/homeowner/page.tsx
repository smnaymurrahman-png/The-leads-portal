import { redirect } from 'next/navigation';
import { LeadsScreen } from '@/components/screens/LeadsScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <LeadsScreen lockedLeadType="HOMEOWNER" />;
}
