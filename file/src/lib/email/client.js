import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_FROM = process.env.EMAIL_FROM || 'Botmakers CRM <noreply@botmakers.ai>';

/**
 * Send an email via Resend.
 * Handles errors gracefully — logs but doesn't crash.
 */
export async function sendEmail({ to, subject, html, from }) {
  try {
    const { data, error } = await resend.emails.send({
      from: from || DEFAULT_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      // CB-INT-001: Resend email failed
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    // CB-INT-001: Resend email failed
    return { success: false, error: err.message };
  }
}
