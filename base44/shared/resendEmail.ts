import { secrets } from "base44:runtime";

/**
 * Send a digest email through Resend (https://resend.com).
 * Used by the daily/weekly/monthly digest backend functions so delivery is
 * independent of the platform's built-in email integration.
 *
 * Requires secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (a verified sending address,
 * e.g. "Astrosetta <hello@astrosetta.com>"). The domain must be verified in Resend.
 */
export async function sendDigestEmail({ to, subject, html, fromName = "Astrosetta" }) {
  const apiKey = secrets.get("RESEND_API_KEY");
  const fromEmail = secrets.get("RESEND_FROM_EMAIL");
  if (!apiKey) throw new Error("RESEND_API_KEY secret is not set");
  if (!fromEmail) throw new Error("RESEND_FROM_EMAIL secret is not set");
  const from = fromEmail.includes("<") ? fromEmail : `${fromName} <${fromEmail}>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = await res.json().catch(() => ({}));
  // Log the Resend email id so every digest send is traceable in the Resend
  // dashboard (Emails tab shows delivery + bounce status per id).
  console.log(`[resend] queued: id=${data.id || 'unknown'}`);
  return { id: data.id || null };
}