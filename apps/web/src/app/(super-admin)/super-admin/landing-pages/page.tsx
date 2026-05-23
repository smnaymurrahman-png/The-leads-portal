import { redirect } from 'next/navigation';
import { LandingPagesScreen } from '@/components/screens/LandingPagesScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <LandingPagesScreen role={session.role} />;
}
