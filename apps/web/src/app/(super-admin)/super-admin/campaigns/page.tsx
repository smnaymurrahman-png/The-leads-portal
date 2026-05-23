import { redirect } from 'next/navigation';
import { CampaignsScreen } from '@/components/screens/CampaignsScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <CampaignsScreen role={session.role} />;
}
