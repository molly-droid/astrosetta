/**
 * send-email — replaces the Base44 SendEmail integration.
 *
 * Body: { to, subject, body, from_name? } (the Base44 integration's shape;
 * body is HTML or plain text).
 *
 * Hardening over Base44: a client (user-JWT) call may only send to the
 * caller's own email address — the app's sole client-side use (Navigator
 * "email me this reading"). Service-role callers (digest functions,
 * scheduled jobs) may send to any recipient.
 */
import { json, handleOptions, getAuthUser, isServiceRole } from '../_shared/edge.ts';
import { sendDigestEmail } from '../_shared/resendEmail.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const { to, subject, body, from_name } = await req.json();
    if (!to || !subject) return json({ error: 'Missing to or subject' }, { status: 400 });

    if (!isServiceRole(req)) {
      const user = await getAuthUser(req);
      if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
      if (!user.email || to.toLowerCase() !== user.email.toLowerCase()) {
        return json({ error: 'Clients may only send email to their own address' }, { status: 403 });
      }
    }

    const result = await sendDigestEmail({ to, subject, html: body ?? '', fromName: from_name });
    return json({ ok: true, id: result?.id });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
});
