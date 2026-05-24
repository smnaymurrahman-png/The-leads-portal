import { redirect } from 'next/navigation';
import { ProfileScreen } from '@/components/screens/ProfileScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <ProfileScreen session={session} />;
}
