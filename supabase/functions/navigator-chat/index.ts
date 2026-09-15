/**
 * navigator-chat — backend for the Chart Navigator conversation flow
 * (replaces Base44 agents: the shim's base44.agents.addMessage posts here).
 *
 * Flow: verify the caller owns the conversation, append their message,
 * generate the reply with the chart_navigator persona over bounded history,
 * append it, and save — the client receives both appends via its realtime
 * subscription on agent_conversation.
 *
 * PROVIDER SEAM: generateReply() is the swap point. The migration scope's
 * proposed Navigator backend is Astrology-API.io's hosted chat/completions,
 * pending the ~30-question parity/quality validation. Until that decision,
 * this interim implementation uses Claude directly — the client-side context
 * injection ([CHART CONTEXT] blocks built by FloatingNavigator) already
 * supplies chart data in the messages, so behavior matches the Base44 agent.
 * Requires secret: ANTHROPIC_API_KEY (interim); model via NAVIGATOR_MODEL.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import { json, handleOptions, getAuthUser, serviceClient } from '../_shared/edge.ts';
import { CHART_NAVIGATOR_INSTRUCTIONS } from '../_shared/chartNavigatorPersona.ts';

// The Base44 agent replayed the conversation; context blocks are re-injected
// by the client on each message, so older turns matter less. Bound history to
// keep replay costs sane (flagged in the Navigator API evaluation).
const HISTORY_LIMIT = 30;
const MODEL = Deno.env.get('NAVIGATOR_MODEL') || 'claude-sonnet-5';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function generateReply(history: ChatMessage[]): Promise<string> {
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
