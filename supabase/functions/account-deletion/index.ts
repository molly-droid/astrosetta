/**
 * accountDeletion — Apple-required in-app account deletion flow.
 *
 * Two actions:
 *   request (authenticated): creates a one-time deletion token — only its
 *     SHA-256 hash is stored — and emails the user a confirmation link that
 *     expires in 24 hours. Nothing is deleted at this point.
 *   confirm (token only, no session needed — the email link may open in any
 *     browser): verifies and consumes the token, wipes every personal record
 *     the user owns across the app, anonymizes aggregate usage stats, and
 *     removes (or clears) the account record itself.
 */

import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, serviceClient } from '../_shared/edge.ts';
import { sendDigestEmail } from '../_shared/resendEmail.ts';

const TOKEN_TTL_HOURS = 24;
// Fallback when the client doesn't pass body.origin (APP_URL secret in prod)
const WEB_APP_ORIGIN = Deno.env.get('APP_URL') || 'https://astrosetta.com';

async function handler(req): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const body = await req.json().catch(() => ({}));
    const srv = base44.asServiceRole;

    if (body.action === 'request') {
      const user = await base44.auth.me();
      if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
      const email = user.email || '';
      if (!email) {
        return json({ error: 'Your account has no email on file — contact support to delete it.' }, { status: 400 });
      }
      const origin = body.origin || WEB_APP_ORIGIN;

      // Invalidate any previous pending request for this user
      await srv.entities.AccountDeletionRequest.deleteMany({ user_id: user.id, status: 'pending' });

      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

      await srv.entities.AccountDeletionRequest.create({
        user_id: user.id,
        user_email: email,
        token_hash: tokenHash,
        expires_at: expiresAt,
        status: 'pending',
      });

      await sendDigestEmail({
        to: email,
        subject: 'Confirm your Astrosetta account deletion',
        html: deletionEmailHtml(`${origin}/delete-account?token=${token}`),
      });

      return json({ success: true, expiresAt });
    }

    if (body.action === 'confirm') {
      const token = body.token;
      if (!token || typeof token !== 'string' || token.length > 200) {
        return json({ error: 'This deletion link is invalid or incomplete.' }, { status: 400 });
      }
      const tokenHash = await sha256Hex(token);
      const records = await srv.entities.AccountDeletionRequest.filter({ token_hash: tokenHash });
      const record = records.find((r) => r.status === 'pending');
      if (!record) {
        return json({ error: 'This deletion link is invalid or was already used.' }, { status: 400 });
      }
      if (new Date(record.expires_at) <= new Date()) {
        await srv.entities.AccountDeletionRequest.update(record.id, { status: 'expired' });
        return json({ error: 'This deletion link has expired. Request a fresh one from Profile → Delete Account.' }, { status: 400 });
      }

      const uid = record.user_id;
      const email = record.user_email || '';
      const anonId = 'anon-' + crypto.randomUUID().slice(0, 12);

      // Personal content — permanently deleted
      const wipes = [
        srv.entities.Chart.deleteMany({ user_id: uid }),
        srv.entities.UserProgress.deleteMany({ user_id: uid }),
        srv.entities.UserModuleProgress.deleteMany({ user_id: uid }),
        srv.entities.DailyQuiz.deleteMany({ user_id: uid }),
        srv.entities.XPEvent.deleteMany({ user_id: uid }),
        srv.entities.SynthesisRating.deleteMany({ user_id: uid }),
        srv.entities.CalendarSynthesis.deleteMany({ user_id: uid }),
        srv.entities.PlannerJournalEntry.deleteMany({ user_id: uid }),
        srv.entities.UserInterpretationRating.deleteMany({ user_id: uid }),
        srv.entities.UserPlacementProgress.deleteMany({ user_id: uid }),
        srv.entities.Interpretation.deleteMany({ contributor_id: uid }),
        srv.entities.SavedChart.deleteMany({ created_by_id: uid }),
        srv.entities.Feedback.deleteMany({ user_id: uid }),
        srv.entities.Feedback.deleteMany({ created_by_id: uid }),
      ];
      if (email) {
        wipes.push(srv.entities.WaitlistEmail.deleteMany({ email }));
        if (email.toLowerCase() !== email) {
          wipes.push(srv.entities.WaitlistEmail.deleteMany({ email: email.toLowerCase() }));
        }
      }

      // Aggregate usage stats — anonymized so totals survive but can never be
      // linked back to the person
      wipes.push(srv.entities.LLMUsageLog.updateMany({ user_id: uid }, { $set: { user_id: anonId } }));
      wipes.push(srv.entities.ErrorLog.updateMany({ user_id: uid }, { $set: { user_id: anonId } }));

      await Promise.all(wipes);

      // The account itself — delete the Supabase auth user (cascades to the
      // public.users row), so the login is gone too, matching Base44's
      // account removal; otherwise clear every personal field off it
      let accountRemoved = false;
      try {
        const { error: authErr } = await serviceClient().auth.admin.deleteUser(uid);
        if (authErr) throw authErr;
        accountRemoved = true;
      } catch {
        try {
          await srv.entities.User.update(uid, {
            display_name: null,
            birth_date: null,
            birth_location: null,
            daily_email_opt_in: false,
          });
        } catch { /* leave the record untouched */ }
      }

      await srv.entities.AccountDeletionRequest.update(record.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      return json({ success: true, accountRemoved });
    }

    return json({ error: 'Unknown action — use "request" or "confirm".' }, { status: 400 });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function deletionEmailHtml(link) {
  return `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background: #FDFBF7;">
  <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #FDFBF7; color: #2C3E50;">
    <p style="text-align: center; color: #C9A961; font-size: 28px; margin: 0 0 8px 0;">&#10022;</p>
    <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 24px; text-align: center; margin: 0 0 20px 0;">Confirm your account deletion</h1>
    <p style="font-size: 15px; line-height: 22px;">You asked us to delete your Astrosetta account. Nothing has been deleted yet — tap the button below within 24 hours to confirm.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${link}" style="background: #C9A961; color: #2C3E50; padding: 13px 30px; border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 15px;">Delete my account</a>
    </div>
    <p style="font-size: 13px; line-height: 20px; color: #8B7355;">
      This will permanently erase your natal chart, saved charts, readings, quiz history, streaks, XP, learning progress, journal entries, and saved interpretations. Only anonymous aggregate usage stats are kept — nothing in them can be linked back to you.
    </p>
    <p style="font-size: 13px; line-height: 20px; color: #8B7355;">
      If you didn't request this, you can ignore this email — your account stays untouched. The link expires in 24 hours and can only be used once.
    </p>
    <p style="text-align: center; color: #C9A961; margin: 28px 0 0 0;">&#10022; Astrosetta &#10022;</p>
  </div>
</body>
</html>`;
}

Deno.serve(handler);
