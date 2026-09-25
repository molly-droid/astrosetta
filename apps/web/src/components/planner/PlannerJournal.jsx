import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, Save, Loader2 } from 'lucide-react';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';

// Simple entity-backed journal — one entry per user per day
// Data stored as JSON in the notes field: { themes_response, invites_response, freeform }
function parseNotes(raw) {
  if (!raw) return { themes_response: '', invites_response: '', freeform: '' };
  try { return JSON.parse(raw); } catch { return { themes_response: raw, invites_response: '', freeform: '' }; }
}

function serializeNotes(fields) {
  return JSON.stringify(fields);
}

const THOUGHT_STARTERS = [
  "What's asking for your attention today?",
  "Where is today's energy showing up in your life?",
  "What feels most alive in you right now?",
  "What is today inviting you to notice?",
  "What pattern keeps surfacing for you?",
  "What would feeling supported look like?",
  "What is your inner world quietly asking for?",
];

export default function PlannerJournal({ dateKey, userId, synthesis, periodLabel = 'Today' }) {
  const [entry, setEntry] = useState(null);
  const [fields, setFields] = useState({ themes_response: '', invites_response: '', freeform: '' });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    setEntry(null);
    setFields({ themes_response: '', invites_response: '', freeform: '' });
    if (open) loadEntry();
  }, [dateKey]);

  useEffect(() => {
    if (open && !loaded.current) loadEntry();
  }, [open]);

  const loadEntry = async () => {
    loaded.current = true;
    const entries = await base44.entities.PlannerJournalEntry.filter({ user_id: userId, date_key: dateKey });
    if (entries[0]) {
      setEntry(entries[0]);
      setFields(parseNotes(entries[0].notes));
    } else {
      setEntry(null);
      setFields({ themes_response: '', invites_response: '', freeform: '' });
    }
  };

  const save = async () => {
    setSaving(true);
    const notes = serializeNotes(fields);
    if (entry) {
      await base44.entities.PlannerJournalEntry.update(entry.id, { notes });
    } else {
      const created = await base44.entities.PlannerJournalEntry.create({ user_id: userId, date_key: dateKey, notes });
      setEntry(created);
    }
    setSaving(false);
  };

  const setField = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const hasContent = fields.themes_response || fields.invites_response || fields.freeform;

  // Pull prompts from synthesis
  const themesLabel = synthesis?.key_themes?.length
    ? `${periodLabel}'s themes: ${synthesis.key_themes.join(', ')}`
    : `${periodLabel}'s themes`;
  const invitesLabel = synthesis?.maximize
    ? `${periodLabel} invites you to: ${Array.isArray(synthesis.maximize) ? synthesis.maximize.slice(0, 2).join(', ') : synthesis.maximize}`
    : `${periodLabel} invites you to`;

  // Collapsed sub-header — a short thought-starter question. Ties to the
  // day's reading when synthesis is ready, otherwise rotates daily.
  const thoughtStarter = synthesis?.key_themes?.[0]
    ? `Where is "${synthesis.key_themes[0]}" showing up for you?`
    : THOUGHT_STARTERS[new Date(dateKey + 'T12:00:00').getDay()];

  return (
    <div className="celestial-card overflow-hidden">
      <CollapsibleCardHeader
        icon={<BookOpen size={14} />}
        title="Journal"
        subtitle={thoughtStarter}
        expanded={open}
        onToggle={() => setOpen(!open)}
        rightExtra={entry && hasContent ? <span className="font-body text-[9px] text-gold-accent/60 italic">Saved</span> : null}
      />

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gold-primary/20 pt-4">

          {/* Field 1: Today's themes */}
          <div className="space-y-1.5">
            <p className="font-body text-xs text-gold-accent/80 leading-snug">{themesLabel}</p>
            <p className="font-body text-[10px] text-white/40 italic mb-1">Which of these feels most alive for you right now?</p>
            <textarea
              value={fields.themes_response}
              onChange={e => setField('themes_response', e.target.value)}
              placeholder="What themes are most present for you today..."
              rows={2}
              className="w-full bg-paper border border-gold-primary/20 rounded-lg px-3 py-2 font-body text-sm text-white/90 placeholder:text-brass/25 focus:outline-none focus:border-gold-accent resize-none"
            />
          </div>

          {/* Field 2: Today invites you to */}
          <div className="space-y-1.5">
            <p className="font-body text-xs text-gold-accent/80 leading-snug">{invitesLabel}</p>
            <p className="font-body text-[10px] text-white/40 italic mb-1">How might you act on this energy today?</p>
            <textarea
              value={fields.invites_response}
              onChange={e => setField('invites_response', e.target.value)}
              placeholder="How I might act on this..."
              rows={2}
              className="w-full bg-paper border border-gold-primary/20 rounded-lg px-3 py-2 font-body text-sm text-white/90 placeholder:text-brass/25 focus:outline-none focus:border-gold-accent resize-none"
            />
          </div>

          {/* Field 3: Freeform */}
          <div className="space-y-1.5">
            <p className="font-body text-xs text-brass/60 uppercase tracking-widest text-[10px]">Notes · Dreams · Reflections · Plans</p>
            <textarea
              value={fields.freeform}
              onChange={e => setField('freeform', e.target.value)}
              placeholder="What else are you noticing? Any synchronicities, dreams, or thoughts..."
              rows={3}
              className="w-full bg-paper border border-gold-primary/20 rounded-lg px-3 py-2 font-body text-sm text-white/90 placeholder:text-brass/25 focus:outline-none focus:border-gold-accent resize-y"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 font-body text-xs text-brass hover:text-white transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? 'Saving...' : 'Save entry'}
          </button>
        </div>
      )}
    </div>
  );
}