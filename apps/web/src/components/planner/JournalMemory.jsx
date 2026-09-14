import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, Clock } from 'lucide-react';

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
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function JournalMemory({ dateKey, userId }) {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !dateKey) return;
    fetchMemory();
  }, [userId, dateKey]);

  const fetchMemory = async () => {
    setLoading(true);
    setMemory(null);
    try {
      // Parse the current date
      const [y, m, d] = dateKey.split('-').map(Number);
      // Look for entries from ~1 year ago: same month/day, previous year
      // Query a range of ±7 days around the same date last year
      const lastYear = y - 1;
      const targetDate = new Date(lastYear, m - 1, d);
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + 3);

      const startKey = startDate.toLocaleDateString('en-CA');
      const endKey = endDate.toLocaleDateString('en-CA');

      // Fetch journal entries for this user in the date range
      const entries = await base44.entities.PlannerJournalEntry.filter({ user_id: userId });
      const matching = entries
        .filter(e => e.date_key >= startKey && e.date_key <= endKey)
        .filter(e => parseNotes(e.notes))
        .sort((a, b) => b.date_key.localeCompare(a.date_key));

      if (matching.length > 0) {
        setMemory(matching[0]);
      }
    } catch (e) {
      // Silent fail — this is a nice-to-have feature
    }
    setLoading(false);
  };

  if (loading || !memory) return null;

  const parsed = parseNotes(memory.notes);
  if (!parsed) return null;

  const hasContent = parsed.freeform || parsed.themes_response || parsed.invites_response;
  if (!hasContent) return null;

  const yearsAgo = new Date().getFullYear() - parseInt(memory.date_key.split('-')[0]);

  return (
    <div className="celestial-card p-4 space-y-3 border-l-2" style={{ borderLeftColor: 'rgba(168, 212, 217, 0.4)' }}>
      <div className="flex items-center gap-2">
        <Clock size={13} className="text-celestial-blue" />
        <p className="font-body text-[10px] uppercase tracking-widest text-celestial-blue">
          {yearsAgo > 1 ? `${yearsAgo} years ago` : 'Last year'} · {formatDateLabel(memory.date_key)}
        </p>
      </div>

      {parsed.themes_response && (
        <div className="space-y-1">
          <p className="font-body text-[10px] text-brass/50 uppercase tracking-wide">Themes</p>
          <p className="font-body text-xs text-white/70 italic leading-relaxed">{parsed.themes_response}</p>
        </div>
      )}

      {parsed.invites_response && (
        <div className="space-y-1">
          <p className="font-body text-[10px] text-brass/50 uppercase tracking-wide">Invitations</p>
          <p className="font-body text-xs text-white/70 italic leading-relaxed">{parsed.invites_response}</p>
        </div>
      )}

      {parsed.freeform && (
        <div className="space-y-1">
          <p className="font-body text-[10px] text-brass/50 uppercase tracking-wide">Reflections</p>
          <p className="font-body text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{parsed.freeform}</p>
        </div>
      )}
    </div>
  );
}