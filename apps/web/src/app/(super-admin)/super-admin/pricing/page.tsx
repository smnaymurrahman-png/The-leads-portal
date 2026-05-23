import { redirect } from 'next/navigation';
import { PricingScreen } from '@/components/screens/PricingScreen';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return <PricingScreen />;
}
