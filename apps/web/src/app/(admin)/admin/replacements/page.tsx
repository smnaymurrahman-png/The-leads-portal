import { redirect } from 'next/navigation';
import { ReplacementsScreen } from '@/components/screens/ReplacementsScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <ReplacementsScreen role={session.role} />;
}
