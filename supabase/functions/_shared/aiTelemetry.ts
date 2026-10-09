import { serviceClient } from './edge.ts';

type Metrics = {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  estimated_credits?: number;
};
type Context = { userId?: string; task: string; provider: string; model: string };

// Optional operator-supplied rates, keyed by the EXACT model identifier. Never
// invent a current vendor price or report an estimate as an invoiced amount.
export function estimateCost(model: string, metrics: Metrics): number | null {
  try {
    const rates = JSON.parse(Deno.env.get('AI_MODEL_RATES_JSON') || '{}')[model];
    if (!rates || metrics.input_tokens == null || metrics.output_tokens == null) return null;
    let cost = 0;
    for (const [metric, rate] of [['input_tokens', 'input'], ['output_tokens', 'output'], ['cache_read_tokens', 'cache_read'], ['cache_write_tokens', 'cache_write']] as const) {
      const count = metrics[metric] || 0;
      if (count && (typeof rates[rate] !== 'number' || !Number.isFinite(rates[rate]) || rates[rate] < 0)) return null;
      cost += count * (rates[rate] || 0) / 1000000;
    }
    return cost;
  } catch { return null; }
}

export async function withAiTelemetry<T>(context: Context, operation: (record: (metrics: Metrics) => void) => Promise<T>): Promise<T> {
  const started = Date.now();
  let outcome = 'error';
  const metrics: Metrics = {};
  try {
    const result = await operation(update => Object.assign(metrics, update));
    outcome = 'success';
    return result;
  } finally {
    try {
      const model = metrics.model || context.model;
      const { error } = await serviceClient().from('ai_request_metrics').insert({
        user_id: context.userId || null, task: context.task, provider: context.provider,
        ...metrics, model, outcome, latency_ms: Date.now() - started,
        estimated_cost_usd: estimateCost(model, metrics),
      });
      if (error) throw error;
    } catch {
      // Observability outages must not lose an already-generated paid reply.
      console.warn('AI metrics write failed', { task: context.task, provider: context.provider });
    }
  }
}
