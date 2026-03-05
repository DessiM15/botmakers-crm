import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireTeam } from '@/lib/auth/helpers';
import { interpretVoiceCommand } from '@/lib/ai/client';
import { executeVoiceAction } from '@/lib/voice/executor';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const user = await requireTeam(cookieStore);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { text, context, mode, action, params } = body;

    // Execute mode: run a confirmed action
    if (mode === 'execute') {
      if (!action || !params) {
        return NextResponse.json({ error: 'Action and params are required for execute mode' }, { status: 400 });
      }
      const result = await executeVoiceAction(action, params);
      return NextResponse.json(result);
    }

    // Interpret mode (default): parse natural language into action
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > 500) {
      return NextResponse.json({ error: 'Command too long (max 500 characters)' }, { status: 400 });
    }

    const interpretation = await interpretVoiceCommand(text.trim(), context || {});

    // If the action is a query (no confirmation needed), execute immediately
    if (interpretation.understood && !interpretation.requiresConfirmation) {
      const result = await executeVoiceAction(interpretation.action, interpretation.params);
      return NextResponse.json({
        ...interpretation,
        result,
      });
    }

    return NextResponse.json(interpretation);
  } catch (error) {
    return NextResponse.json(
      { error: `Voice command failed: ${error.message}` },
      { status: 500 }
    );
  }
}
