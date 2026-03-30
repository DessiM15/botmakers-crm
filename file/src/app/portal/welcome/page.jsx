import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth/helpers';
import WelcomeWalkthrough from '@/components/crm/WelcomeWalkthrough';

export const metadata = {
  title: 'Welcome — Client Portal — Botmakers',
};

export default async function PortalWelcomePage() {
  const cookieStore = await cookies();
  let client;
  try {
    const result = await requireClient(cookieStore);
    client = result.client;
  } catch {
    redirect('/portal/login');
  }

  // Already completed onboarding — redirect to portal
  if (client.portalOnboardingComplete) {
    redirect('/portal');
  }

  return <WelcomeWalkthrough clientName={client.fullName} />;
}
