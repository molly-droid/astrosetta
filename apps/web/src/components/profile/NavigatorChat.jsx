import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Send, Plus, MessageSquare, ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUGGESTIONS = [
  "Why am I so sensitive to what others say about me?",
  "What placement explains my daddy issues?",
  "Why do I keep attracting unavailable partners?",
  "What does my chart say about my career path?",
  "Why do I struggle to set boundaries?",
  "What's my most challenging placement?",
];

export default function NavigatorChat({ user, chart }) {
  const [conversation, setConversation] = useState(null);
  const [allConversations, setAllConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    initConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversations = async () => {
    setLoading(true);
    const existing = await base44.agents.listConversations({ agent_name: 'chart_navigator' });
    setAllConversations(existing || []);
    if (existing?.length > 0) {
      await loadConversation(existing[0].id);
    } else {
      await startNewConversation();
    }
    setLoading(false);
  };

  const loadConversation = async (id) => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    const convo = await base44.agents.getConversation(id);
    setConversation(convo);
    setMessages(convo.messages || []);
    setShowHistory(false);
    unsubscribeRef.current = base44.agents.subscribeToConversation(id, (data) => {
      setMessages(data.messages || []);
    });
  };

  const startNewConversation = async () => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    const convo = await base44.agents.createConversation({
      agent_name: 'chart_navigator',
      metadata: { name: `Reading — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` },
    });
    const updated = await base44.agents.listConversations({ agent_name: 'chart_navigator' });
    setAllConversations(updated || []);
    setConversation(convo);
    setMessages([]);
    setShowHistory(false);
    unsubscribeRef.current = base44.agents.subscribeToConversation(convo.id, (data) => {
      setMessages(data.messages || []);
    });
  };

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || !conversation || sending) return;
    setInput('');
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gold-primary/50" />
      </div>
    );
  }

  const visibleMessages = messages.filter(m => m.role !== 'system');

  // History panel
  if (showHistory) {
    return (
      <div className="flex flex-col" style={{ height: '60vh', minHeight: 320 }}>
        <div className="celestial-card px-4 py-3 mb-3 flex-shrink-0 flex items-center gap-3">
          <button onClick={() => setShowHistory(false)} className="text-brass/60 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <p className="font-display text-sm font-bold text-white flex-1">Conversations</p>
          <button
            onClick={startNewConversation}
            className="flex items-center gap-1.5 text-[11px] font-body text-gold-accent hover:text-gold-primary transition-colors"
          >
            <Plus size={13} /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {allConversations.map((c) => {
            const isActive = c.id === conversation?.id;
            const label = c.metadata?.name || 'Conversation';
            const date = new Date(c.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`w-full text-left celestial-card px-3 py-2.5 hover:bg-gold-primary/10 transition-colors flex items-center gap-2.5 ${isActive ? 'ring-1 ring-gold-primary/30' : ''}`}
              >
                <MessageSquare size={13} className="text-gold-accent/60 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-white/80 truncate">{label}</p>
                  <p className="font-body text-[10px] text-brass/50">{date}</p>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-gold-accent flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '60vh', minHeight: 320 }}>
      {/* Header */}
      <div className="celestial-card px-4 py-3 mb-3 flex-shrink-0 flex items-center gap-2">
        <div className="flex-1">
          <p className="font-display text-sm font-bold text-white">✦ Chart Navigator</p>
          <p className="font-body text-[10px] text-brass/60 mt-0.5">
            Ask anything about your chart, placements, or patterns in your life.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowHistory(true)}
            title="Conversation history"
            className="p-1.5 rounded-lg hover:bg-gold-primary/10 text-brass/50 hover:text-gold-accent transition-colors"
          >
            <MessageSquare size={14} />
          </button>
          <button
            onClick={startNewConversation}
            title="New conversation"
            className="p-1.5 rounded-lg hover:bg-gold-primary/10 text-brass/50 hover:text-gold-accent transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {visibleMessages.length === 0 && (
          <div className="space-y-3">
            <p className="font-body text-xs text-brass/50 text-center italic pt-2">
              {chart ? 'Your chart is loaded. Ask me anything.' : 'Complete your birth chart first for personalized answers.'}
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="w-full text-left celestial-card px-3 py-2.5 hover:bg-gold-primary/10 transition-colors"
                >
                  <p className="font-body text-xs text-white/70 leading-snug">{s}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map((m, i) => {
          const isUser = m.role === 'user';
          const isStreaming = !isUser && i === visibleMessages.length - 1 && sending;
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                isUser
                  ? 'bg-gold-primary/20 text-white'
                  : 'celestial-card text-white/90'
              }`}>
                {isUser ? (
                  <p className="font-body text-sm leading-relaxed">{m.content}</p>
                ) : (
                  <ReactMarkdown
                    className="font-body text-sm leading-relaxed prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  >
                    {m.content || (isStreaming ? '…' : '')}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}

        {sending && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="celestial-card px-4 py-3 rounded-2xl">
              <Loader2 size={14} className="animate-spin text-gold-primary/50" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pt-2">
        <div className="flex gap-2 items-end celestial-card px-3 py-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about your chart…"
            rows={1}
            className="flex-1 bg-transparent font-body text-sm text-white placeholder:text-white/25 outline-none resize-none leading-relaxed"
            style={{ maxHeight: 80 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending}
            className="p-1.5 rounded-full bg-gold-primary/30 hover:bg-gold-primary/50 disabled:opacity-30 transition-colors flex-shrink-0"
          >
            <Send size={14} className="text-gold-accent" />
          </button>
        </div>
      </div>
    </div>
  );
}