import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

/**
 * F-03 — every past journal entry, newest first.
 *
 * Until now an entry only reappeared if you navigated back to the exact day it
 * was written on. This lists them all by date and opens any one in place.
 */

function parseNotes(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.freeform || parsed.themes_response || parsed.invites_response) return parsed;
    return null;
  } catch {
    return raw?.trim() ? { freeform: raw } : null;
  }
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function Field({ label, text }) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      <p className="font-body text-[0.625rem] text-brass/50 uppercase tracking-wide">{label}</p>
      <p className="font-body text-xs text-white/75 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export default function JournalHistory({ userId, onOpenDate = null, currentDateKey = null }) {
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    if (!expanded || entries || !userId) return;
    let cancelled = false;
    setLoading(true);
    base44.entities.PlannerJournalEntry.filter({ user_id: userId })
      .then((rows) => {
        if (cancelled) return;
        const withContent = (rows || [])
          .filter((e) => parseNotes(e.notes))
          .sort((a, b) => String(b.date_key).localeCompare(String(a.date_key)));
        setEntries(withContent);
      })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [expanded, entries, userId]);

  if (!userId) return null;

  return (
    <div className="celestial-card p-4 space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <BookOpen size={13} className="text-gold-accent shrink-0" />
        <span className="font-body text-[0.625rem] uppercase tracking-widest text-brass flex-1">Journal history</span>
        {expanded ? <ChevronDown size={14} className="text-brass/40" /> : <ChevronRight size={14} className="text-brass/40" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center gap-1.5 py-2">
              <Loader2 size={11} className="animate-spin text-gold-primary" />
              <span className="font-body text-[0.6875rem] text-brass italic">Loading your entries…</span>
            </div>
          )}

          {!loading && entries?.length === 0 && (
            <p className="font-body text-xs text-brass/60 italic py-1">
              No journal entries yet. Anything you write on a day shows up here.
            </p>
          )}

          {!loading && entries?.map((entry) => {
            const parsed = parseNotes(entry.notes);
            const isOpen = openKey === entry.date_key;
            return (
              <div key={entry.id || entry.date_key} className="rounded-lg border border-white/[0.07] overflow-hidden">
                <button
                  onClick={() => setOpenKey(isOpen ? null : entry.date_key)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <span className="font-body text-xs text-white/85">
                    {formatDateLabel(entry.date_key)}
                    {entry.date_key === currentDateKey && (
                      <span className="ml-2 font-body text-[0.5625rem] text-gold-accent uppercase tracking-wide">today</span>
                    )}
                  </span>
                  {isOpen ? <ChevronDown size={12} className="text-brass/40 shrink-0" /> : <ChevronRight size={12} className="text-brass/30 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-white/[0.05]">
                    <Field label="Themes" text={parsed?.themes_response} />
                    <Field label="Invitations" text={parsed?.invites_response} />
                    <Field label="Notes" text={parsed?.freeform} />
                    {onOpenDate && entry.date_key !== currentDateKey && (
                      <button
                        onClick={() => onOpenDate(entry.date_key)}
                        className="font-body text-[0.625rem] text-gold-accent hover:text-gold-primary transition-colors"
                      >
                        Open that day →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
