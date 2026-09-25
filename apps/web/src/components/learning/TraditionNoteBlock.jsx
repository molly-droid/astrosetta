import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { TRADITIONS, getTradition } from '@/lib/traditions';
import OrnamentDivider from '@/components/ui/OrnamentDivider';

/**
 * Renders a module's inline "Tradition lens" — a collapsible containing one tab
 * per tradition_note block in the module. Visible to all users regardless of
 * tier. Defaults to the user's active tradition when one is set.
 *
 * Props:
 *   notes: array of { tradition: 'modern'|'hellenistic'|'vedic', content: string }
 *   activeTradition: the user's active_tradition (or null)
 */
export default function TraditionNoteBlock({ notes, activeTradition }) {
  const [open, setOpen] = useState(false);
  const presentKeys = notes.map(n => n.tradition);
  const ordered = TRADITIONS.filter(t => presentKeys.includes(t.key));
  const defaultKey = activeTradition && presentKeys.includes(activeTradition)
    ? activeTradition
    : ordered[0]?.key;
  const [activeTab, setActiveTab] = useState(defaultKey);
  const active = notes.find(n => n.tradition === activeTab) || notes[0];

  if (!notes || notes.length === 0) return null;

  return (
    <div className="animate-fade-up space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gold-primary/25 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        {open ? <Minus size={13} className="text-gold-accent" /> : <Plus size={13} className="text-gold-accent" />}
        <span className="font-display text-xs font-bold text-gold-accent uppercase tracking-widest">⊕ Tradition lens</span>
        <span className="font-body text-[10px] text-brass/50 ml-auto">
          {ordered.map(t => t.short).join(' · ')}
        </span>
      </button>

      {open && (
        <div className="celestial-card p-4 space-y-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-full p-0.5">
            {ordered.map(t => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex-1 px-2 py-1 rounded-full font-body text-[10px] transition-all flex items-center justify-center gap-1 ${
                    isActive ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'
                  }`}
                  style={isActive ? { background: `${t.color}33`, color: t.color } : {}}
                >
                  <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>{t.glyph}</span>
                  {t.short}
                </button>
              );
            })}
          </div>

          <OrnamentDivider />

          {/* Content */}
          {active && (
            <div>
              <p className="font-body text-[10px] uppercase tracking-widest mb-1.5" style={{ color: getTradition(active.tradition).color }}>
                In {getTradition(active.tradition).label} tradition
              </p>
              <div className="font-body text-sm text-white/90 leading-relaxed
                [&_strong]:font-bold [&_strong]:text-white [&_em]:italic [&_em]:text-brass
                [&_p]:mb-2 [&_p:last-child]:mb-0">
                <ReactMarkdown>{active.content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}