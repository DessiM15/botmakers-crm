import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { polishReplyWithAI } from '@/lib/ai/client';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const { question, draft, projectName } = await request.json();

    if (!question || !draft) {
      return NextResponse.json(
        { error: 'CB-API-001: question and draft are required' },
        { status: 400 }
      );
    }

    const polished = await polishReplyWithAI({
      question,
      draft,
      projectName: projectName || 'Project',
    });

    return NextResponse.json({ polished });
  } catch (err) {
    return NextResponse.json(
      { error: 'CB-INT-002: AI polish failed' },
      { status: 500 }
    );
  }
}
