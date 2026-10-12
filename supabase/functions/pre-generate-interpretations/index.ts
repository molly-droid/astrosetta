/**
 * preGenerateInterpretations — background job that pre-generates the chart
 * deep-dive readings (classic planet placements + houses) for every chart,
 * storing them in CalendarSynthesis (period_type "interpretation") under the
 * same param-hash keys the frontend's interpretationStore reads (PF-03:
 * readings persist per account and are already there when a new user first
 * opens their chart).
 *
 * Processes ONE chart per call, capped at GEN_CAP generations, so each run
 * stays well inside the Edge Function time budget; the scheduled job runs
 * every 10 minutes and catches new charts up quickly. Pass { chart_id } to
 * target a specific chart.
 */
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, isServiceRole } from '../_shared/edge.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { TASKS } from '../_shared/llm_tasks/registry.ts';
import { pregenItemsForChart } from '../_shared/interpretationPregen.ts';

const GEN_CAP = 8;
const TASK = 'interpretation-deep-dive';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin' && !isServiceRole(req)) {
      return json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let body: { chart_id?: string } = {};
    try { body = await req.json(); } catch { /* no body — scheduled run */ }

    const def = TASKS[TASK];
    const svc = base44.asServiceRole.entities.CalendarSynthesis;
    const charts = await base44.asServiceRole.entities.Chart.list();

    // Pick the chart to process: the requested one, else the first with a
    // missing pre-generated reading.
    let target: Record<string, unknown> | null = null;
    let missing: ReturnType<typeof pregenItemsForChart> = [];
    for (const chart of charts) {
      if (body.chart_id && chart.id !== body.chart_id) continue;
      const items = pregenItemsForChart(chart.raw_data || {});
      if (!items.length) { if (body.chart_id) break; continue; }
      const existing = await svc.filter({ user_id: chart.user_id, period_type: 'interpretation' });
      const have = new Set(existing.map((r: { period_key: string }) => r.period_key));
      const todo = items.filter((it) => !have.has(it.key));
      if (todo.length || body.chart_id) { target = chart; missing = todo; break; }
    }

    if (!target) {
      return json({ status: 'complete', message: 'All charts have their pre-generated interpretations' });
    }
    if (!missing.length) {
      return json({ status: 'complete', chart_id: target.id, message: 'Chart already covered' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const results: Array<Record<string, unknown>> = [];
    for (const item of missing.slice(0, GEN_CAP)) {
      try {
        const prompt = def.build(item.params);
        const text = await invokeLLM({
          prompt,
          model: def.model,
          telemetry: { userId: String(target.user_id), task: `pre-gen:${TASK}` },
        });
        const payload = {
          user_id: target.user_id,
          period_type: 'interpretation',
          period_key: item.key,
          topic_key: TASK,
          date_start: today,
          date_end: today,
          summary: item.label,
          description: typeof text === 'string' ? text : JSON.stringify(text),
          data: text,
          generated_at: new Date().toISOString(),
        };
        // Re-check before writing: a concurrent run (or the user's own device)
        // may have saved this item while we were generating — update, don't
        // duplicate.
        const nowExisting = await svc.filter({ user_id: target.user_id, period_type: 'interpretation', period_key: item.key });
        if (nowExisting[0]) {
          await svc.update(nowExisting[0].id, payload);
        } else {
          await svc.create(payload);
        }
        results.push({ item: item.label, status: 'ok' });
      } catch (err) {
        results.push({ item: item.label, status: 'error', error: (err as Error).message });
      }
    }

    return json({
      chart_id: target.id,
      user_id: target.user_id,
      generated: results,
      remaining_for_chart: Math.max(0, missing.length - GEN_CAP),
    });
  } catch (error) {
    return json({ error: (error as Error).message }, { status: 500 });
  }
});
