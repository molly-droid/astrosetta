/**
 * Resend email helper — ported from base44/shared/resendEmail.ts
 * (secrets.get -> Deno.env.get; otherwise the same behavior).
 *
 * Requires secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (a verified sending
 * address, e.g. "Astrosetta <hello@astrosetta.com>"). The domain must be
 * verified in Resend.
 */
export async function sendEmail({
  to,
  subject,
  html,
  fromName = 'Astrosetta',
}: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey) throw new Error('RESEND_API_KEY secret is not set');
  if (!fromEmail) throw new Error('RESEND_FROM_EMAIL secret is not set');
  const from = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
  return await res.json();
}
