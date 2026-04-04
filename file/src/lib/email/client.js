import { Resend } from 'resend';

let _resend;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'Botmakers CRM <noreply@botmakers.ai>';

/**
 * Send an email via Resend.
 * Handles errors gracefully — logs but doesn't crash.
 */
export async function sendEmail({ to, cc, subject, html, from }) {
  try {
    const payload = {
      from: from || DEFAULT_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (cc) {
      payload.cc = Array.isArray(cc) ? cc : [cc];
    }
    const { data, error } = await getResend().emails.send(payload);

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
