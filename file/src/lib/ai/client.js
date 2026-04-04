import Anthropic from '@anthropic-ai/sdk';
import { LEAD_ANALYSIS_SYSTEM_PROMPT, PROPOSAL_GENERATION_PROMPT, REPLY_POLISH_PROMPT, EMAIL_GENERATION_PROMPT, FOLLOW_UP_EMAIL_PROMPT, VOICE_COMMAND_PROMPT, LEAD_RESPONSE_PROMPT, DISCOVERY_CALL_PROMPT, CAMPAIGN_EMAIL_PROMPT } from './prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Safely parse JSON from Claude responses.
 * Handles markdown code fences that Claude sometimes adds.
 */
function safeParseJSON(text) {
  let cleaned = text.trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned);
}

/**
 * Analyze a lead using Claude and return structured assessment.
 * @param {Object} leadData - Lead record from database
 * @returns {Object} - { score, prospect_summary, project_summary, complexity, estimated_effort, key_questions, red_flags, recommended_next_step }
 */
export async function analyzeLeadWithAI(leadData) {
  const userMessage = `Analyze this lead for BotMakers Inc.:

Name: ${leadData.fullName}
Email: ${leadData.email}
Phone: ${leadData.phone || 'Not provided'}
Company: ${leadData.companyName || 'Not provided'}
Project Type: ${leadData.projectType || 'Not specified'}
Project Timeline: ${leadData.projectTimeline || 'Not specified'}
Existing Systems: ${leadData.existingSystems || 'Not specified'}
Referral Source: ${leadData.referralSource || 'Not specified'}
Preferred Contact: ${leadData.preferredContact || 'email'}
Project Details: ${leadData.projectDetails || 'Not provided'}
Lead Source: ${leadData.source || 'web_form'}
Created: ${leadData.createdAt}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: LEAD_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text;
  const analysis = safeParseJSON(text);

  return analysis;
}

/**
 * Generate a personalized lead response email using Claude.
 * @param {Object} leadData - Lead record from database
 * @returns {Object} - { subject, body_html, body_text }
 */
export async function generateLeadResponseWithAI(leadData) {
  const analysis = leadData.aiInternalAnalysis;

  const userMessage = `Generate a personalized response email for this lead who contacted BotMakers:

Name: ${leadData.fullName}
Email: ${leadData.email}
Company: ${leadData.companyName || 'Not provided'}
Project Type: ${leadData.projectType || 'Not specified'}
Project Timeline: ${leadData.projectTimeline || 'Not specified'}
Existing Systems: ${leadData.existingSystems || 'Not specified'}
Project Details: ${leadData.projectDetails || 'Not provided'}
Lead Source: ${leadData.source || 'web_form'}

${analysis ? `AI Analysis:
- Prospect Summary: ${analysis.prospect_summary || 'N/A'}
- Project Summary: ${analysis.project_summary || 'N/A'}
- Complexity: ${analysis.complexity || 'N/A'}
- Estimated Effort: ${analysis.estimated_effort || 'N/A'}
- Recommended Next Step: ${analysis.recommended_next_step || 'N/A'}` : 'No AI analysis available yet.'}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    system: LEAD_RESPONSE_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text;
  return safeParseJSON(text);
}

/**
 * Generate a proposal using Claude based on context.
 * @param {Object} params
 * @param {Object} params.leadData - Lead/client info
 * @param {string} params.discoveryNotes - Discovery meeting notes
 * @param {string} params.pricingType - 'fixed', 'phased', or 'hourly'
 * @returns {Object} - { title, scope_of_work, deliverables, terms_and_conditions, suggested_line_items }
 */
export async function generateProposalWithAI({ leadData, discoveryNotes, pricingType }) {
  const userMessage = `Generate a proposal for the following prospect:

Name: ${leadData.fullName || 'Not provided'}
Email: ${leadData.email || 'Not provided'}
Company: ${leadData.companyName || leadData.company || 'Not provided'}
Project Type: ${leadData.projectType || 'Not specified'}
Project Details: ${leadData.projectDetails || 'Not provided'}

Discovery Notes:
${discoveryNotes || 'No discovery notes provided.'}

Pricing Type: ${pricingType}

${leadData.aiProspectSummary ? `AI Analysis Summary: ${leadData.aiProspectSummary}` : ''}
${leadData.aiInternalAnalysis?.project_summary ? `Project Summary: ${leadData.aiInternalAnalysis.project_summary}` : ''}
${leadData.aiInternalAnalysis?.complexity ? `Complexity: ${leadData.aiInternalAnalysis.complexity}` : ''}
${leadData.aiInternalAnalysis?.estimated_effort ? `Estimated Effort: ${leadData.aiInternalAnalysis.estimated_effort}` : ''}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: PROPOSAL_GENERATION_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text;
  const proposal = safeParseJSON(text);

  return proposal;
}

/**
 * Generate a professional email using Claude.
 * @param {Object} params
 * @param {string} params.recipientName
 * @param {string} params.recipientEmail
 * @param {string} params.recipientCompany
 * @param {string} params.category - Email template category
 * @param {string} params.holidayType - Specific holiday (if category is 'holiday')
 * @param {string} params.tone - professional/friendly/casual
 * @param {string} params.customInstructions - Optional extra context
 * @param {string} params.senderName - Team member's name
 * @param {string} params.recipientHistory - CRM history summary
 * @returns {Object} - { subject, body_html, body_text }
 */
export async function generateEmailWithAI({
  recipientName,
  recipientEmail,
  recipientCompany,
  category,
  holidayType,
  tone,
  customInstructions,
  senderName,
  recipientHistory,
}) {
  const categoryLabels = {
    follow_up: 'Follow-Up (after a call, meeting, or initial contact)',
    introduction: 'Introduction (cold outreach, first touch)',
    proposal_follow_up: 'Proposal Follow-Up (nudge after sending a proposal)',
    check_in: 'Check-In (general touch base)',
    thank_you: 'Thank You (after signing, payment, referral)',
    project_update: 'Project Update (milestone completed, progress report)',
    holiday: `Holiday Greeting — ${holidayType || 'General'}`,
    win_back: 'Win-Back (re-engage a cold/stale lead)',
    referral_request: 'Referral Request (ask a happy client for referrals)',
  };

  const userMessage = `Generate a ${tone} ${categoryLabels[category] || category} email.

Recipient: ${recipientName}
Email: ${recipientEmail}
Company: ${recipientCompany || 'Not specified'}
Sender: ${senderName}, Co-Founder at BotMakers.ai

${recipientHistory ? `CRM History:\n${recipientHistory}` : 'No CRM history available.'}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    system: EMAIL_GENERATION_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text;
  return safeParseJSON(text);
}

/**
 * Generate a follow-up email draft for a lead.
 * @param {Object} params
 * @param {string} params.leadName
 * @param {string} params.company
 * @param {string} params.pipelineStage
 * @param {string} params.triggerReason
 * @param {string} params.lastInteraction
 * @returns {Object} - { subject, body_html, body_text }
 */
export async function generateFollowUpEmail({ leadName, company, pipelineStage, triggerReason, lastInteraction }) {
  const userMessage = `Lead: ${leadName} at ${company || 'their company'}
Current stage: ${pipelineStage.replace(/_/g, ' ')}
Reason for follow-up: ${triggerReason}
Last interaction: ${lastInteraction || 'No recent interaction recorded'}

Write a brief, warm, professional follow-up email.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: FOLLOW_UP_EMAIL_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text;
  return safeParseJSON(text);
}

/**
 * Interpret a voice command using Claude.
 * @param {string} text - The natural language command
 * @param {Object} context - Optional page context
 * @returns {Object} - { understood, action, params, confirmMessage, requiresConfirmation }
 */
export async function interpretVoiceCommand(text, context = {}) {
  const userMessage = `Command: "${text}"
${context.currentPage ? `Current page: ${context.currentPage}` : ''}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512,
    system: VOICE_COMMAND_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const result = response.content[0].text;
  return safeParseJSON(result);
}

/**
 * Process a discovery call transcript: summarize the call AND generate a proposal.
 * @param {Object} params
 * @param {Object} params.leadData - Lead record from database
 * @param {string} params.transcript - Raw call transcript
 * @param {string} params.pricingType - 'fixed', 'phased', or 'hourly'
 * @returns {Object} - { summary, proposal }
 */
export async function processDiscoveryCallWithAI({ leadData, transcript, pricingType }) {
  const userMessage = `Analyze this discovery call transcript for a potential project with BotMakers.ai.

Prospect: ${leadData.fullName || 'Unknown'}
Company: ${leadData.companyName || 'Unknown'}
Project Type: ${leadData.projectType || 'Not specified'}
Pricing Model: ${pricingType}

${leadData.aiInternalAnalysis?.project_summary ? `Prior AI Analysis: ${leadData.aiInternalAnalysis.project_summary}` : ''}

--- TRANSCRIPT START ---
${transcript}
--- TRANSCRIPT END ---`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 6144,
    system: DISCOVERY_CALL_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text;
  return safeParseJSON(text);
}

/**
 * Generate a personalized campaign email using Claude.
 * @param {Object} params
 * @param {string} params.recipientName
 * @param {string} params.recipientCompany
 * @param {string} params.audienceType - 'client' or 'lead'
 * @param {Object} params.context - Rich context data (projects, milestones, etc.)
 * @param {string} params.promptContext - Campaign-specific instructions
 * @param {string} params.subjectTemplate - Subject line hint
 * @returns {Object} - { subject, body_html }
 */
export async function generateCampaignEmailWithAI({
  recipientName,
  recipientCompany,
  audienceType,
  context,
  promptContext,
  subjectTemplate,
}) {
  let contextSummary = '';

  if (audienceType === 'client' && context) {
    const projectList = context.projects?.map(p => `- ${p.name} (${p.status})`).join('\n') || 'None';
    const milestoneList = context.milestones?.map(m => `- ${m.title} (${m.status})`).join('\n') || 'None';
    const proposalList = context.proposals?.map(p => `- ${p.title} (${p.status})`).join('\n') || 'None';
    const invoiceList = context.invoices?.map(i => `- ${i.title}: $${i.amount} (${i.status})`).join('\n') || 'None';

    contextSummary = `CLIENT DATA:
Projects:\n${projectList}
Recent Milestones:\n${milestoneList}
Proposals:\n${proposalList}
Invoices:\n${invoiceList}`;
  } else if (audienceType === 'lead' && context) {
    contextSummary = `LEAD DATA:
Pipeline Stage: ${context.pipelineStage || 'Unknown'}
Score: ${context.score || 'Unscored'}
Company: ${context.companyName || 'Unknown'}
Project Type: ${context.projectType || 'Not specified'}
Last Contacted: ${context.lastContactedAt || 'Never'}`;
  }

  const userMessage = `Generate a personalized campaign email.

Recipient: ${recipientName}
Company: ${recipientCompany || 'Not specified'}
Audience: ${audienceType}
Subject Template: ${subjectTemplate}

Campaign Instructions: ${promptContext || 'Send a helpful, personalized update.'}

${contextSummary}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    system: CAMPAIGN_EMAIL_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].text;
  return safeParseJSON(text);
}

/**
 * Polish a draft reply to a client question using Claude.
 * @param {Object} params
 * @param {string} params.question - The client's original question
 * @param {string} params.draft - The team member's draft reply
 * @param {string} params.projectName - The project name for context
 * @returns {string} - Polished reply text
 */
export async function polishReplyWithAI({ question, draft, projectName }) {
  const userMessage = `Project: ${projectName}

Client's Question:
${question}

Draft Reply:
${draft}

Please polish this reply.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: REPLY_POLISH_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text;
}
