import { redirect } from 'next/navigation';
import { LeadColumnEditorScreen } from '@/components/screens/LeadColumnEditorScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login');
  }
  return <LeadColumnEditorScreen />;
}
