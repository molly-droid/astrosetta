// Base44 agents (Navigator conversations) -> Supabase.
//
// Conversations live in agent_conversation rows with a jsonb messages
// array — the shape FloatingNavigator expects ({ id, agent_name, metadata,
// messages }). addMessage posts to the navigator-chat Edge Function, which
// owns the persona + provider call (per the scope: Astrology-API.io hosted
// chat) and appends both the user message and the reply to the row; the
// realtime subscription then delivers the updated messages to the client.
import { supabase } from './supabase.js';

const TABLE = 'agent_conversation';

function throwOn(error) {
  if (error) {
    const err = new Error(error.message);
    err.data = error;
    throw err;
  }
}

export const agents = {
  async listConversations({ agent_name } = {}) {
    let q = supabase.from(TABLE).select('*').order('updated_date', { ascending: false });
    if (agent_name) q = q.eq('agent_name', agent_name);
    const { data, error } = await q;
    throwOn(error);
    return data;
  },

  async getConversation(id) {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
    throwOn(error);
    return data;
  },

  async createConversation({ agent_name, metadata } = {}) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ agent_name, metadata: metadata ?? {}, messages: [] })
      .select()
      .single();
    throwOn(error);
    return data;
  },

  async addMessage(conversation, message) {
    const { data, error } = await supabase.functions.invoke('navigator-chat', {
      body: { conversation_id: conversation.id, message },
    });
    if (error) {
      const err = Object.assign(new Error(error.message || 'navigator-chat failed'), {
        code: undefined, status: error.context?.status, data: error,
      });
      // FunctionsHttpError carries the structured gate/quota response here.
      try {
        const body = await error.context?.json();
        err.code = body?.code;
      } catch { /* network errors may have no JSON response */ }
      throw err;
    }
    return data;
  },

  subscribeToConversation(id, callback) {
    const channel = supabase
      .channel(`conversation:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${id}` },
        (payload) => callback(payload.new)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};
