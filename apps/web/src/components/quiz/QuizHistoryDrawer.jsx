import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { History, Loader2 } from 'lucide-react';
import TierBadge from './TierBadge';

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-gold-primary' : 'bg-red-300';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-body text-xs text-brass w-8 text-right">{score}%</span>
    </div>
  );
}

export default function QuizHistoryDrawer({ userProgress }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && history.length === 0) fetchHistory();
  }, [open]);

  const fetchHistory = async () => {
    setLoading(true);
    const records = await base44.entities.DailyQuiz.list('-date_key', 30);
    setHistory(records.filter(q => q.completed_at));
    setLoading(false);
  };

  const streak = userProgress?.consecutive_streak_count || 0;
  const best = userProgress?.streak_best || 0;
  const accuracy = userProgress?.accuracy_rate || 0;
  const total = userProgress?.total_answered || 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-brass font-body text-xs gap-1.5 h-7 px-2">
          <History size={13} />
          History
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl bg-cream border-gold-primary/30 max-h-[80vh] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-gold-primary/20">
          <SheetTitle className="font-display text-deep-blue text-lg">Quiz History</SheetTitle>
        </SheetHeader>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 py-4 border-b border-gold-primary/10">
          {[
            { label: 'Streak', value: `${streak}d` },
            { label: 'Best', value: `${best}d` },
            { label: 'Accuracy', value: `${accuracy}%` },
            { label: 'Answered', value: total },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-display text-xl font-bold text-deep-blue">{s.value}</p>
              <p className="font-body text-[10px] text-brass uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gold-primary" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-center font-body text-sm text-brass italic py-8">No completed quizzes yet.</p>
        ) : (
          <div className="space-y-2 pt-4">
            {history.map(q => (
              <div key={q.id} className="flex items-center gap-3 py-2.5 px-3 bg-paper/60 border border-gold-primary/20 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-body text-xs text-deep-blue font-semibold">
                      {new Date(q.date_key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </p>
                    <TierBadge tier={q.tier_at_completion || q.tier} showFlame={false} />
                  </div>
                  <ScoreBar score={q.score ?? 0} />
                </div>
                <div className="text-right shrink-0">
                  <p className="font-body text-[10px] text-brass">
                    {(q.user_answers || []).filter(a => a.is_correct).length}/{q.questions?.length || 0} correct
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}