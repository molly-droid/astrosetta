import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

const ADMIN_EMAIL = 'hello@astrosetta.com';
const APP_URL = 'https://astrosetta.com';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const body = await req.json().catch(() => ({}));

    // Allow manual trigger (admin) or scheduled trigger
    if (!body.scheduled) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return json({ error: 'Forbidden: admin only' }, { status: 403 });
      }
    }

    // Fetch all feedback from the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const allFeedback = await base44.asServiceRole.entities.Feedback.list('-created_date', 200);

    const weekFeedback = allFeedback.filter(f => f.created_date >= oneWeekAgo);
    const featureRequests = weekFeedback.filter(f => f.type === 'feature_request');
    const generalFeedback = weekFeedback.filter(f => f.type === 'general');
    const bugReports = weekFeedback.filter(f => f.type === 'bug');

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
    const weekEnd = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Chicago' });

    if (featureRequests.length === 0 && generalFeedback.length === 0 && bugReports.length === 0) {
      return json({ skipped: true, reason: 'No feedback this week' });
    }

    // Format feedback items for the LLM
    const formatItems = (items) => items.map((f, i) =>
      `${i + 1}. Subject: "${f.subject}"\n   Description: ${f.description?.slice(0, 400) || '(none)'}${f.description?.length > 400 ? '...' : ''}`
    ).join('\n\n');

    const frText = featureRequests.length ? formatItems(featureRequests) : 'None this week.';
    const genText = generalFeedback.length ? formatItems(generalFeedback) : 'None this week.';
    const bugText = bugReports.length ? formatItems(bugReports) : 'None this week.';

    const prompt = `You are the product advisor for Astrosetta, an astrology learning and transit-tracking app currently in beta.

Here is the user feedback submitted this week (${weekStart} – ${weekEnd}):

FEATURE REQUESTS (${featureRequests.length}):
${frText}

GENERAL FEEDBACK (${generalFeedback.length}):
${genText}

BUG REPORTS for reference (${bugReports.length}):
${bugText}

Your job: Write a concise product digest for the founder. Return JSON with:
- summary: 2-3 sentence executive summary of the week's feedback themes
- feature_request_recommendations: array of objects {item, recommendation, priority} — for each feature request, give a clear recommendation ("Build it", "Defer", "Investigate further", or "Won't build") and a priority ("High", "Medium", "Low") with a 1-sentence rationale
- general_feedback_insights: array of 1-3 insight strings drawn from general feedback — patterns, sentiment, notable comments
- bug_summary: 1-2 sentence overview of bug report patterns (severity, frequency, pages affected)
- top_priority_action: the single most important thing to act on this week, in 1-2 sentences
- overall_sentiment: "positive", "mixed", or "negative"`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          feature_request_recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                recommendation: { type: 'string' },
                priority: { type: 'string' },
              },
            },
          },
          general_feedback_insights: { type: 'array', items: { type: 'string' } },
          bug_summary: { type: 'string' },
          top_priority_action: { type: 'string' },
          overall_sentiment: { type: 'string' },
        },
        required: ['summary', 'feature_request_recommendations', 'general_feedback_insights', 'top_priority_action'],
      },
    });

    const BG = '#FDFBF7', CARD = '#F5F1E8', GOLD = '#A07C3F', GOLD2 = '#B08D4A', TEXT = '#2C3E50', MUTED = '#8B7355';
    const GREEN = '#A8C8A8', BLUE = '#9DB4C8', RED = '#D8B4C2', PURPLE = '#B8A5C8';

    const priorityColor = (p) => p === 'High' ? RED : p === 'Medium' ? GOLD : MUTED;
    const recColor = (r) => r === 'Build it' ? GREEN : r === "Won't build" ? RED : r === 'Defer' ? MUTED : BLUE;
    const sentimentEmoji = (s) => s === 'positive' ? '😊' : s === 'negative' ? '😟' : '😐';

    const frRows = (llm.feature_request_recommendations || []).map(rec => `
      <tr><td style="padding:10px 14px;border-left:3px solid ${recColor(rec.recommendation)};background:${CARD};border-radius:6px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="font-family:Georgia,serif;font-size:14px;color:${TEXT};font-weight:bold;line-height:1.4;">${rec.item}</div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <span style="font-family:Georgia,serif;font-size:10px;color:${recColor(rec.recommendation)};border:1px solid ${recColor(rec.recommendation)}44;border-radius:999px;padding:2px 8px;white-space:nowrap;">${rec.recommendation}</span>
            <span style="font-family:Georgia,serif;font-size:10px;color:${priorityColor(rec.priority)};border:1px solid ${priorityColor(rec.priority)}44;border-radius:999px;padding:2px 8px;white-space:nowrap;">${rec.priority}</span>
          </div>
        </div>
      </td></tr><tr><td style="height:8px;"></td></tr>`).join('');

    const insightItems = (llm.general_feedback_insights || []).map(ins =>
      `<li style="font-family:Georgia,serif;font-size:14px;color:${TEXT};line-height:1.6;margin-bottom:6px;padding-left:4px;">• ${ins}</li>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}</style></head>
<body bgcolor="#FDFBF7" style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="text-align:center;padding:16px 24px 20px;">
    <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;">✦ Astrosetta Admin ✦</div>
    <div style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:${TEXT};margin-top:6px;">Weekly Feedback Digest</div>
    <div style="font-family:Georgia,serif;font-size:12px;color:${MUTED};margin-top:4px;">${weekStart} – ${weekEnd}</div>
  </td></tr>

  <!-- Stats row -->
  <tr><td style="padding:0 24px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:33%;text-align:center;padding:14px 8px;background:${CARD};border-radius:10px;border:1px solid ${RED}33;">
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:${RED};">${bugReports.length}</div>
          <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};margin-top:2px;">Bug Reports</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:29%;text-align:center;padding:14px 8px;background:${CARD};border-radius:10px;border:1px solid ${GREEN}33;">
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:${GREEN};">${featureRequests.length}</div>
          <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};margin-top:2px;">Feature Requests</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:30%;text-align:center;padding:14px 8px;background:${CARD};border-radius:10px;border:1px solid ${GOLD}33;">
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:${GOLD};">${generalFeedback.length}</div>
          <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};margin-top:2px;">General Feedback</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Top priority action -->
  <tr><td style="padding:0 24px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}55;border-radius:12px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-family:Georgia,serif;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${GOLD};margin-bottom:8px;">🎯 Top Priority Action This Week</div>
        <div style="font-family:Georgia,serif;font-size:15px;color:${TEXT};line-height:1.6;">${llm.top_priority_action || ''}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Summary -->
  <tr><td style="padding:0 24px 16px;">
    <div style="font-family:Georgia,serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${GOLD};margin-bottom:8px;">
      ${sentimentEmoji(llm.overall_sentiment || 'mixed')} Week Summary
    </div>
    <p style="font-family:Georgia,serif;font-size:14px;color:${TEXT};line-height:1.7;margin:0;background:${CARD};padding:14px 18px;border-radius:8px;border-left:3px solid ${GOLD}55;">${llm.summary || ''}</p>
  </td></tr>

  <!-- Feature Requests -->
  ${featureRequests.length > 0 ? `
  <tr><td style="padding:0 24px 8px;">
    <div style="font-family:Georgia,serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${GREEN};margin-bottom:10px;">💡 Feature Requests — Recommendations</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${frRows}</table>
  </td></tr>` : ''}

  <!-- General feedback insights -->
  ${generalFeedback.length > 0 ? `
  <tr><td style="padding:0 24px 16px;">
    <div style="font-family:Georgia,serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${GOLD};margin-bottom:8px;">💬 General Feedback Insights</div>
    <ul style="list-style:none;padding:0;margin:0;background:${CARD};border-radius:8px;padding:14px 18px;">${insightItems}</ul>
  </td></tr>` : ''}

  <!-- Bug summary -->
  ${bugReports.length > 0 ? `
  <tr><td style="padding:0 24px 16px;">
    <div style="font-family:Georgia,serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${RED};margin-bottom:8px;">🐛 Bug Report Summary</div>
    <p style="font-family:Georgia,serif;font-size:14px;color:${TEXT};line-height:1.7;margin:0;background:${CARD};padding:14px 18px;border-radius:8px;border-left:3px solid ${RED}55;">${llm.bug_summary || `${bugReports.length} bug reports this week.`}</p>
  </td></tr>` : ''}

  <!-- CTA -->
  <tr><td style="padding:8px 24px 24px;text-align:center;">
    <a href="${APP_URL}/admin" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:999px;">Manage Feedback in Admin →</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ADMIN_EMAIL,
      from_name: 'Astrosetta Digest',
      subject: `✦ Weekly Feedback Digest: ${featureRequests.length + generalFeedback.length + bugReports.length} items (${weekStart} – ${weekEnd})`,
      body: html,
    });

    return json({
      success: true,
      sent_to: ADMIN_EMAIL,
      total: weekFeedback.length,
      bugs: bugReports.length,
      features: featureRequests.length,
      general: generalFeedback.length,
    });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});