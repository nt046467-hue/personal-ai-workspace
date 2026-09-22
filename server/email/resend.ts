import { config } from '../config';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  id?: string;
  success: boolean;
}

/**
 * Sends an email via Resend's REST API.
 * Throws an error if RESEND_API_KEY is not configured or if the delivery fails.
 * Callers should catch errors so unauthenticated API requests do not reveal delivery status.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = config.resendApiKey;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured. Email dispatch aborted.');
  }

  const payload: Record<string, any> = {
    from: config.emailFrom,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (text) {
    payload.text = text;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Resend email delivery failed: ${errorMsg}`);
  }

  return {
    id: data?.id,
    success: true,
  };
}
