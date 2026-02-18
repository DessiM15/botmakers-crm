import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';
import { db } from '@/lib/db/client';
import { leads, clients, contacts } from '@/lib/db/schema';
import { eq, desc, or, and } from 'drizzle-orm';
import { generateEmailWithAI } from '@/lib/ai/client';
import { generateEmailSchema } from '@/lib/utils/validators';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    await requireTeam(cookieStore);

    const body = await request.json();
    const parsed = generateEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'CB-API-001: ' + parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      recipientName,
      recipientEmail,
      recipientCompany,
      category,
      holidayType,
      tone,
      customInstructions,
      senderName,
    } = parsed.data;

    // Build recipient history from CRM data
    let recipientHistory = '';

    // Check if recipient is a lead
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.email, recipientEmail))
      .limit(1);

    if (lead) {
      recipientHistory += `Type: Lead\n`;
      recipientHistory += `Pipeline Stage: ${lead.pipelineStage}\n`;
      if (lead.score) recipientHistory += `Score: ${lead.score}\n`;
      if (lead.projectType) recipientHistory += `Project Type: ${lead.projectType}\n`;
      if (lead.projectDetails) recipientHistory += `Project Details: ${lead.projectDetails}\n`;
      if (lead.aiProspectSummary) recipientHistory += `AI Summary: ${lead.aiProspectSummary}\n`;

      // Get last 5 contacts for this lead
      const recentContacts = await db
        .select()
        .from(contacts)
        .where(eq(contacts.leadId, lead.id))
        .orderBy(desc(contacts.createdAt))
        .limit(5);

      if (recentContacts.length > 0) {
        recipientHistory += `\nRecent Contact History:\n`;
        recentContacts.forEach((c) => {
          recipientHistory += `- ${c.type} (${c.direction}) on ${new Date(c.createdAt).toLocaleDateString()}: ${c.subject || 'No subject'}\n`;
        });
      }
    }

    // Check if recipient is a client
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.email, recipientEmail))
      .limit(1);

    if (client) {
      recipientHistory += `${lead ? '\n' : ''}Type: Client\n`;
      recipientHistory += `Company: ${client.company || 'N/A'}\n`;
      recipientHistory += `Client since: ${new Date(client.createdAt).toLocaleDateString()}\n`;

      // Get last 5 contacts for this client
      const recentContacts = await db
        .select()
        .from(contacts)
        .where(eq(contacts.clientId, client.id))
        .orderBy(desc(contacts.createdAt))
        .limit(5);

      if (recentContacts.length > 0) {
        recipientHistory += `\nRecent Contact History:\n`;
        recentContacts.forEach((c) => {
          recipientHistory += `- ${c.type} (${c.direction}) on ${new Date(c.createdAt).toLocaleDateString()}: ${c.subject || 'No subject'}\n`;
        });
      }
    }

    const result = await generateEmailWithAI({
      recipientName,
      recipientEmail,
      recipientCompany: recipientCompany || client?.company || lead?.companyName || '',
      category,
      holidayType,
      tone,
      customInstructions,
      senderName,
      recipientHistory: recipientHistory || undefined,
    });

    return NextResponse.json({ success: true, email: result });
  } catch (error) {
    if (error.message?.startsWith('CB-')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'CB-INT-002: AI email generation failed' },
      { status: 500 }
    );
  }
}
