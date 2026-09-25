import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { invokeLLMTask } from '@/api/llmTasks';

/**
 * Generates 2–3 follow-up question suggestions based on the conversation so far.
 * Only appears after the latest assistant response (when not loading).
 * Caches by last assistant message content so we don't re-call the LLM on every render.
 */
export default function ContextualSuggestions({ messages, sending, onSelect }) {
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
  const lastContent = lastAssistant?.content || '';

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef({ content: null, suggestions: [] });

  useEffect(() => {
    if (sending || !lastContent) {
      setSuggestions([]);
      return;
    }
    // Already cached for this response
    if (cacheRef.current.content === lastContent) {
      setSuggestions(cacheRef.current.suggestions);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Build a trimmed conversation summary for the LLM
    const recent = messages
      .filter(m => m.role !== 'system')
      .slice(-6)
      .map(m => {
        const text = m.content || '';
        const marker = '---\n\nUSER QUESTION: ';
        const idx = text.indexOf(marker);
        const clean = idx >= 0 ? text.slice(idx + marker.length) : text;
        return `${m.role === 'user' ? 'User' : 'Navigator'}: ${clean.slice(0, 400)}`;
      })
      .join('\n');

    invokeLLMTask('navigator-suggestions', { conversation: recent })
      .then(result => {
        if (cancelled) return;
        const qs = (result?.questions || []).filter(Boolean).slice(0, 3);
        cacheRef.current = { content: lastContent, suggestions: qs };
        setSuggestions(qs);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lastContent, sending]);

  if (sending || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
      {suggestions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className="text-left px-2.5 py-1.5 rounded-full hover:bg-gold-primary/15 transition-colors"
          style={{ background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.18)' }}
        >
          <span className="font-body text-[11px] text-white/65 leading-snug flex items-center gap-1">
            <Sparkles size={9} className="text-gold-accent/50 shrink-0" />
            {q}
          </span>
        </button>
      ))}
    </div>
  );
}