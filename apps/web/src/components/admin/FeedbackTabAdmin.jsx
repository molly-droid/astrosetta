import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Bug, Lightbulb, MessageSquare, ChevronDown, ChevronUp, ExternalLink, Mail, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TYPE_META = {
  bug: { icon: Bug, color: '#D8B4C2', label: 'Bug' },
  feature_request: { icon: Lightbulb, color: '#A8C8A8', label: 'Feature' },
  general: { icon: MessageSquare, color: '#C9A961', label: 'General' },
  cancellation: { icon: TrendingDown, color: '#9DB4C8', label: 'Downgrade' },
};

const STATUS_COLORS = {
  open: 'text-gold-accent',
  reviewing: 'text-blue-300',
  resolved: 'text-green-soft',
  wont_fix: 'text-white/40',
};

export default function FeedbackTabAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');
  const [testingBug, setTestingBug] = useState(false);
  const [testingDigest, setTestingDigest] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  const sendTestBugAlert = async () => {
    setTestingBug(true);
    setTestMsg(null);
    try {
      // Create a fake bug feedback record to trigger the real flow
      const fake = await base44.entities.Feedback.create({
        type: 'bug',
        subject: '[TEST] Admin panel bug alert test',
        description: 'This is a test bug report triggered from the admin panel to verify the email notification flow.',
        page_url: '/admin',
      });
      setTestMsg({ ok: true, text: 'Bug alert email sent — check your inbox.' });
      // Clean up the test record after a moment
      setTimeout(() => base44.entities.Feedback.delete(fake.id).catch(() => {}), 5000);
    } catch (e) {
      setTestMsg({ ok: false, text: 'Failed: ' + (e?.message || 'unknown error') });
    }
    setTestingBug(false);
  };

  const sendTestDigest = async () => {
    setTestingDigest(true);
    setTestMsg(null);
    try {
      const res = await base44.functions.invoke('sendFeedbackDigest', {});
      const d = res.data;
      if (d?.skipped) {
        setTestMsg({ ok: false, text: 'No feedback found in the last 7 days to include in the digest.' });
      } else {
        setTestMsg({ ok: true, text: `Digest sent — ${d?.total || 0} items (${d?.bugs || 0} bugs, ${d?.features || 0} features, ${d?.general || 0} general).` });
      }
    } catch (e) {
      setTestMsg({ ok: false, text: 'Failed: ' + (e?.message || 'unknown error') });
    }
    setTestingDigest(false);
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const res = await base44.entities.Feedback.list('-created_date', 100);
      setItems(res);
    } catch (e) {}
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    await base44.entities.Feedback.update(id, { status });
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-gold-primary" size={24} /></div>;
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-gold-accent" />
        <h2 className="font-display text-lg font-bold text-white">Feedback</h2>
        <span className="font-body text-xs text-brass/60">({items.length})</span>
      </div>

      {/* Email testing */}
      <div className="celestial-card p-4 space-y-3">
        <p className="font-body text-[10px] uppercase tracking-widest text-brass/60">Email Testing</p>
        <div className="flex gap-3 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={sendTestBugAlert}
            disabled={testingBug || testingDigest}
            className="border-white/10 text-white font-body text-xs h-8 gap-1.5"
          >
            {testingBug ? <Loader2 size={12} className="animate-spin" /> : <Bug size={12} />}
            Test Bug Alert
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={sendTestDigest}
            disabled={testingBug || testingDigest}
            className="border-white/10 text-white font-body text-xs h-8 gap-1.5"
          >
            {testingDigest ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            Send Weekly Digest Now
          </Button>
        </div>
        {testMsg && (
          <p className={`font-body text-xs ${testMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{testMsg.text}</p>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'reviewing', 'resolved', 'wont_fix'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full font-body text-xs transition-all ${
              filter === f
                ? 'bg-gold-primary/20 text-white border border-gold-accent/40'
                : 'text-brass/60 border border-white/[0.08] hover:border-gold-primary/20'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="font-body text-sm text-brass/50 text-center py-8">No feedback yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const meta = TYPE_META[item.type] || TYPE_META.general;
            const Icon = meta.icon;
            const isOpen = expanded === item.id;
            return (
              <div key={item.id} className="celestial-card overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <Icon size={16} className="mt-0.5 shrink-0" style={{ color: meta.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-white font-semibold truncate">{item.subject}</p>
                    <p className="font-body text-xs text-brass/50 mt-0.5">
                      {meta.label} · {new Date(item.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className={`font-body text-[10px] uppercase tracking-wide ${STATUS_COLORS[item.status] || 'text-white/40'}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
                    <p className="font-body text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{item.description}</p>

                    {item.screenshot_url && (
                      <a href={item.screenshot_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-body text-xs text-gold-accent hover:underline">
                        <ExternalLink size={12} /> View screenshot
                      </a>
                    )}

                    {item.page_url && (
                      <p className="font-body text-[10px] text-brass/40">Page: {item.page_url}</p>
                    )}

                    <div className="flex gap-2 flex-wrap pt-1">
                      {['open', 'reviewing', 'resolved', 'wont_fix'].map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(item.id, s)}
                          className={`px-2.5 py-1 rounded-full font-body text-[10px] transition-all ${
                            item.status === s
                              ? 'bg-gold-primary/20 text-white border border-gold-accent/40'
                              : 'text-brass/50 border border-white/[0.06] hover:border-gold-primary/20'
                          }`}
                        >
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
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