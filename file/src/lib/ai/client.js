import Anthropic from '@anthropic-ai/sdk';
import { LEAD_ANALYSIS_SYSTEM_PROMPT, PROPOSAL_GENERATION_PROMPT, REPLY_POLISH_PROMPT, EMAIL_GENERATION_PROMPT } from './prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  const analysis = JSON.parse(text);

  return analysis;
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
  const proposal = JSON.parse(text);

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
  return JSON.parse(text);
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
