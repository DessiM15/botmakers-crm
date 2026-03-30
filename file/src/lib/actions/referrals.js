'use server';

import { db } from '@/lib/db/client';
import { referrers, activityLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeam } from '@/lib/auth/helpers';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { referrerCreateSchema } from '@/lib/utils/validators';

/**
 * Generate a URL-safe slug from a name.
 * e.g. "John Doe" → "john-doe"
 * Appends a random suffix if needed for uniqueness.
 */
function generateSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

/**
 * Create a new referrer manually from the CRM.
 */
export async function createReferrer(formData) {
  try {
    const cookieStore = await cookies();
    const { teamUser } = await requireTeam(cookieStore);

    const parsed = referrerCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { error: 'CB-API-001: ' + parsed.error.issues[0].message };
    }

    const data = parsed.data;
    const slug = generateSlug(data.fullName);

    const [inserted] = await db
      .insert(referrers)
      .values({
        fullName: data.fullName,
        email: data.email,
        company: data.company || null,
        feedback: data.feedback || null,
        slug,
        totalReferrals: 0,
      })
      .returning();

    await db.insert(activityLog).values({
      actorId: teamUser.id,
      actorType: 'team',
      action: 'referrer.created',
      entityType: 'referrer',
      entityId: inserted.id,
    });

    revalidatePath('/referrals');

    return { success: true, referrer: inserted };
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return { error: error.message };
    }
    return { error: 'CB-DB-001: Failed to create referrer' };
  }
}
