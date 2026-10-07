import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, getAuthUser, isServiceRole } from '../_shared/edge.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  // Base44 automation on user signup — service-role only (DB webhook/trigger wiring).
  if (!isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const base44 = compatClient(req);
    const body = await req.json().catch(() => ({}));

    // Entity automation payload — fires on Chart creation
    const chartData = body.data;
    if (!chartData?.user_id) return json({ skipped: 'no user_id' });

    // Look up user email (catch in case user_id is invalid format)
    const users = await base44.asServiceRole.entities.User.filter({ id: chartData.user_id }).catch(() => []);
    const user = users?.[0];
    if (!user?.email) return json({ skipped: 'no email found' });

    const appUrl = 'https://astrosetta.com';
    const sunSign = chartData.sun_sign || 'your Sun sign';
    const moonSign = chartData.moon_sign || '';
    const ascSign = chartData.raw_data?.unknown_time ? '' : (chartData.ascendant_sign || '');

    const bigThree = [
      `☉ ${sunSign}`,
      moonSign ? `☽ ${moonSign}` : null,
      ascSign ? `Asc ${ascSign}` : null,
    ].filter(Boolean).join('  ·  ');

    const BG = '#FDFBF7', CARD = '#F5F1E8', GOLD = '#A07C3F', GOLD2 = '#B08D4A', TEXT = '#2C3E50', MUTED = '#8B7355';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}</style></head>
<body bgcolor="#FDFBF7" style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="text-align:center;padding:12px 24px 24px;">
    <div style="font-family:Georgia,serif;font-size:14px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;">✦ Astrosetta ✦</div>
  </td></tr>

  <tr><td style="padding:0 28px 20px;text-align:center;">
    <h1 style="font-family:Georgia,serif;font-size:28px;color:${TEXT};margin:0 0 12px;line-height:1.3;">Welcome to your chart.</h1>
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0;">Your natal chart has been cast.</p>
  </td></tr>

  <tr><td style="padding:0 28px 24px;text-align:center;">
    <div style="display:inline-block;background:${CARD};border:1px solid ${GOLD}33;border-radius:999px;padding:10px 24px;">
      <span style="font-family:Georgia,serif;font-size:16px;color:${GOLD2};">${bigThree}</span>
    </div>
  </td></tr>

  <tr><td style="padding:0 28px 20px;">
    <p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:${TEXT};margin:0 0 14px;">You've just taken the first step toward reading your own chart — not someone else's interpretation, but your own living understanding of the sky.</p>
    <p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:${MUTED};margin:0 0 14px;">Here's what you can do right now:</p>
  </td></tr>

  <tr><td style="padding:0 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

      <tr><td style="padding:10px 16px;background:${CARD};border-radius:10px;border:1px solid ${GOLD}22;margin-bottom:8px;">
        <div style="font-family:Georgia,serif;font-size:14px;color:${GOLD2};margin-bottom:3px;">📖 Take today's quiz</div>
        <div style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.5;">Start a daily streak and build your astrology vocabulary one question at a time.</div>
      </td></tr>
      <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>

      <tr><td style="padding:10px 16px;background:${CARD};border-radius:10px;border:1px solid ${GOLD}22;">
        <div style="font-family:Georgia,serif;font-size:14px;color:${GOLD2};margin-bottom:3px;">🔮 Read your daily horoscope</div>
        <div style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.5;">A personalized reading based on how today's transits interact with your natal chart.</div>
      </td></tr>
      <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>

      <tr><td style="padding:10px 16px;background:${CARD};border-radius:10px;border:1px solid ${GOLD}22;">
        <div style="font-family:Georgia,serif;font-size:14px;color:${GOLD2};margin-bottom:3px;">📅 Explore the Planner</div>
        <div style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.5;">See your transits, weekly syntheses, and lunar events in a calendar view.</div>
      </td></tr>
      <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>

      <tr><td style="padding:10px 16px;background:${CARD};border-radius:10px;border:1px solid ${GOLD}22;">
        <div style="font-family:Georgia,serif;font-size:14px;color:${GOLD2};margin-bottom:3px;">✦ Ask the Navigator</div>
        <div style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.5;">Chat with an AI assistant that knows your chart and can answer any astrology question.</div>
      </td></tr>

    </table>
  </td></tr>

  <tr><td style="padding:24px 28px 8px;text-align:center;">
    <a href="${appUrl}/home" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:999px;">Enter Astrosetta →</a>
  </td></tr>

  <tr><td style="padding:20px 28px 8px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:12px;color:${MUTED};line-height:1.6;margin:0;">Welcome to Astrosetta — the sky is happening right now.<br>Your feedback shapes what we build next.</p>
  </td></tr>

  <tr><td style="padding:16px 28px;text-align:center;">
    <div style="height:1px;background:${GOLD}22;margin-bottom:16px;"></div>
    <p style="font-family:Georgia,serif;font-size:11px;color:${MUTED};line-height:1.6;">
      Sharp Energetics LLC · <a href="${appUrl}/legal" style="color:${GOLD};text-decoration:underline;">Legal</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: 'Astrosetta',
      subject: '✦ Welcome to Astrosetta — Your Chart Awaits',
      body: html,
    });

    return json({ success: true, sent_to: user.email });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});