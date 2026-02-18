'use server';

import { createServerSupabaseClient } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signOutAction() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out errors — always redirect to sign-in
  }
  redirect('/sign-in');
}
