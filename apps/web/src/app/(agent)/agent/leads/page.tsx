import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Agent leads index redirects to the Solar vertical by default. */
export default function Page() {
  redirect('/agent/leads/solar');
}
