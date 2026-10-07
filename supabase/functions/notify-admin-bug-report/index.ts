import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, getAuthUser, isServiceRole } from '../_shared/edge.ts';

const ADMIN_EMAIL = 'hello@astrosetta.com';
const APP_URL = 'https://astrosetta.com';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  // Base44 entity automation on Feedback create — service-role only (DB webhook/trigger wiring).
  if (!isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const base44 = compatClient(req);
    const body = await req.json().catch(() => ({}));

    // Entity automation payload
    const feedbackId = body.event?.entity_id;
    const feedbackData = body.data;

    if (!feedbackId) {
      return json({ error: 'No feedback id in payload' }, { status: 400 });
    }

    // Only handle bug reports
    if (feedbackData?.type !== 'bug') {
      return json({ skipped: true, reason: 'not a bug report' });
    }

    const subject = feedbackData.subject || '(no subject)';
    const description = feedbackData.description || '(no description)';
    const pageUrl = feedbackData.page_url || '';
    const screenshotUrl = feedbackData.screenshot_url || null;
    const submittedAt = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    const BG = '#FDFBF7', CARD = '#F5F1E8', GOLD = '#A07C3F', GOLD2 = '#B08D4A', TEXT = '#2C3E50', MUTED = '#8B7355', RED = '#A85D75';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}</style></head>
<body bgcolor="#FDFBF7" style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="text-align:center;padding:16px 24px 20px;">
    <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;">✦ Astrosetta Admin ✦</div>
    <div style="font-family:Georgia,serif;font-size:12px;color:${MUTED};margin-top:4px;">Bug Report Alert</div>
  </td></tr>

  <tr><td style="padding:0 24px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${RED}55;border-radius:12px;border-left:4px solid ${RED};">
      <tr><td style="padding:18px 20px;">
        <div style="font-family:Georgia,serif;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${RED};margin-bottom:8px;">🐛 New Bug Report</div>
        <div style="font-family:Georgia,serif;font-size:18px;font-weight:bold;color:${TEXT};margin-bottom:6px;">${subject}</div>
        <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};">Submitted ${submittedAt}${pageUrl ? ` · Page: ${pageUrl}` : ''}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 24px 16px;">
    <div style="font-family:Georgia,serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${GOLD};margin-bottom:8px;">Description</div>
    <div style="font-family:Georgia,serif;font-size:14px;color:${TEXT};line-height:1.7;background:${CARD};padding:14px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">${description.replace(/\n/g, '<br>')}</div>
  </td></tr>

  ${screenshotUrl ? `
  <tr><td style="padding:0 24px 16px;">
    <div style="font-family:Georgia,serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${GOLD};margin-bottom:8px;">Screenshot</div>
    <img src="${screenshotUrl}" style="max-width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" />
  </td></tr>
  ` : ''}

  <tr><td style="padding:0 24px 24px;text-align:center;">
    <a href="${APP_URL}/admin" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:999px;">View in Admin Panel →</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      from_name: 'Astrosetta Alerts',
      subject: `🐛 Bug Report: ${subject}`,
      body: html,
    });

    return json({ success: true, notified: ADMIN_EMAIL });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});