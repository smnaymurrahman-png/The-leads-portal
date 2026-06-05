import { redirect } from 'next/navigation';
import { LeadsSheetScreen } from '@/components/screens/LeadsSheetScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <LeadsSheetScreen leadType="HOMEOWNER" editableFollowup />;
}
