/**
 * navigator-chat — backend for the Chart Navigator conversation flow
 * (replaces Base44 agents: the shim's base44.agents.addMessage posts here).
 *
 * Flow: verify the caller owns the conversation, append their message,
 * generate the reply with the chart_navigator persona over bounded history,
 * append it, and save — the client receives both appends via its realtime
 * subscription on agent_conversation.
 *
 * PROVIDER SEAM: generateReply() dispatches on the NAVIGATOR_PROVIDER secret:
 *   'claude' (default)  — Anthropic directly (ANTHROPIC_API_KEY; model via
 *                         NAVIGATOR_MODEL). The interim/baseline provider.
 *   'astrology-api'     — Astrology-API.io hosted chat (ASTROLOGY_API_KEY),
 *                         the scope's proposed backend, subject to the
 *                         30-question parity validation
 *                         (docs/NAVIGATOR_PARITY_TEST.md).
 * Either way the client-side context injection ([CHART CONTEXT] blocks built
 * by FloatingNavigator) supplies chart data in the messages, so behavior
 * matches the Base44 agent.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import { json, handleOptions, getAuthUser, serviceClient } from '../_shared/edge.ts';
import { CHART_NAVIGATOR_INSTRUCTIONS } from '../_shared/chartNavigatorPersona.ts';

// The Base44 agent replayed the conversation; context blocks are re-injected
// by the client on each message, so older turns matter less. Bound history to
// keep replay costs sane (flagged in the Navigator API evaluation).
const HISTORY_LIMIT = 30;
const MODEL = Deno.env.get('NAVIGATOR_MODEL') || 'claude-sonnet-5';
const PROVIDER = Deno.env.get('NAVIGATOR_PROVIDER') || 'claude';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function generateClaudeReply(history: ChatMessage[]): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret is not set');
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: CHART_NAVIGATOR_INSTRUCTIONS,
    messages: history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content })),
  });
  return response.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
}

// Astrology-API.io hosted chat — OpenAI Chat Completions protocol with the
// astro-tuned hosted model. Flat 25 credits/turn (LLM included); billing is
// the client's Astrology-API.io subscription, no Anthropic spend.
async function generateAstrologyApiReply(history: ChatMessage[]): Promise<string> {
  const apiKey = Deno.env.get('ASTROLOGY_API_KEY');
  if (!apiKey) throw new Error('ASTROLOGY_API_KEY secret is not set');
  const res = await fetch('https://api.astrology-api.io/api/v3/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'astro-default',
      stream: false,
      messages: [
        { role: 'system', content: CHART_NAVIGATOR_INSTRUCTIONS },
        ...history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`astrology-api chat ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('astrology-api chat returned no content');
  return content;
}

function generateReply(history: ChatMessage[]): Promise<string> {
  return PROVIDER === 'astrology-api'
    ? generateAstrologyApiReply(history)
    : generateClaudeReply(history);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation_id, message } = await req.json();
    if (!conversation_id || !message?.content) {
      return json({ error: 'Missing conversation_id or message' }, { status: 400 });
    }

    const db = serviceClient();
    const { data: convo, error } = await db
      .from('agent_conversation')
      .select('*')
      .eq('id', conversation_id)
      .single();
    if (error || !convo) return json({ error: 'Conversation not found' }, { status: 404 });
    if (convo.created_by_id !== user.id) return json({ error: 'Forbidden' }, { status: 403 });

    const messages: ChatMessage[] = Array.isArray(convo.messages) ? convo.messages : [];
    messages.push({ role: 'user', content: String(message.content) });

    // Save the user message first so the client's realtime subscription
    // shows it immediately while the reply generates.
    await db.from('agent_conversation')
      .update({ messages })
      .eq('id', conversation_id);

    let reply: string;
    try {
      reply = await generateReply(messages);
    } catch (llmErr) {
      console.error('navigator-chat generation failed:', llmErr);
      reply = 'The stars are quiet for a moment — something went wrong generating a reply. Please try again.';
    }
    messages.push({ role: 'assistant', content: reply });

    const { data: updated, error: saveErr } = await db
      .from('agent_conversation')
      .update({ messages })
      .eq('id', conversation_id)
      .select()
      .single();
    if (saveErr) return json({ error: saveErr.message }, { status: 500 });

    return json(updated);
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
});
