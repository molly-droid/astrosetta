import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { awardXP } from '@/lib/xpUtils';
import OrnamentDivider from '@/components/ui/OrnamentDivider';

const MAX_CHARS = 500;

const TONES = [
  { value: 'psychological', label: 'Psychological' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'predictive', label: 'Predictive' },
  { value: 'lived_experience', label: 'Lived Experience' },
  { value: 'humorous', label: 'Humorous' },
];

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function ContributionForm({ user, onSuccess }) {
  const [placements, setPlacements] = useState([]);
  const [form, setForm] = useState({
    placement_key: '',
    text: '',
    tone: '',
    experience_level: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.entities.Placement.list('-canonical_key', 200).then(setPlacements).catch(() => {});
  }, []);

  const filtered = placements.filter(p =>
    p.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.canonical_key?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.text.length > MAX_CHARS) return;
    setLoading(true);

    await base44.entities.Interpretation.create({
      placement_key: form.placement_key,
      text: form.text,
      tone: form.tone,
      experience_level: form.experience_level,
      contributor_id: user.id,
      source_platform: 'user_submitted',
      status: 'pending',
      rating_score: 0,
      rating_count: 0,
    });

    await awardXP(user.id, 'interpretation_submitted', 25);
    setLoading(false);
    setSubmitted(true);
    onSuccess && onSuccess();
  };

  if (submitted) {
    return (
      <div className="text-center py-10 space-y-4">
        <CheckCircle size={48} className="text-celestial-green mx-auto" />
        <h3 className="font-display text-xl text-deep-blue">Thank You</h3>
        <p className="font-body text-sm text-brass">Your interpretation is under review. You've earned 25 XP.</p>
        <Button
          onClick={() => { setSubmitted(false); setForm({ placement_key: '', text: '', tone: '', experience_level: '' }); }}
          variant="outline"
          className="border-gold-primary/50 text-brass"
        >
          Submit Another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label className="font-body text-deep-blue font-semibold">Placement</Label>
        <input
          type="text"
          placeholder="Search placements…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-paper border border-gold-primary/50 rounded-lg px-3 py-2 font-body text-sm text-deep-blue focus:outline-none focus:border-gold-accent"
        />
        <div className="max-h-40 overflow-y-auto border border-gold-primary/30 rounded-lg bg-paper divide-y divide-gold-primary/20">
          {filtered.slice(0, 20).map(p => (
            <button
              key={p.canonical_key}
              type="button"
              onClick={() => { setForm(f => ({ ...f, placement_key: p.canonical_key })); setSearch(p.display_name); }}
              className={`w-full text-left px-3 py-2 font-body text-sm transition-colors hover:bg-gold-primary/10 ${form.placement_key === p.canonical_key ? 'bg-gold-primary/20 text-deep-blue font-semibold' : 'text-deep-blue'}`}
            >
              {p.display_name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-brass italic">No placements found</p>
          )}
        </div>
      </div>

      <OrnamentDivider />

      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="font-body text-deep-blue font-semibold">Interpretation</Label>
          <span className={`text-xs font-body ${form.text.length > MAX_CHARS ? 'text-destructive' : 'text-brass'}`}>
            {form.text.length}/{MAX_CHARS}
          </span>
        </div>
        <Textarea
          value={form.text}
          onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
          placeholder="Share what this placement means from your experience or study…"
          rows={5}
          className="bg-paper border-gold-primary/50 focus:border-gold-accent font-body text-deep-blue text-sm resize-none"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="font-body text-deep-blue font-semibold text-sm">Tone</Label>
          <Select value={form.tone} onValueChange={v => setForm(f => ({ ...f, tone: v }))}>
            <SelectTrigger className="bg-paper border-gold-primary/50 font-body text-sm text-deep-blue">
              <SelectValue placeholder="Select tone" />
            </SelectTrigger>
            <SelectContent>
              {TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-body text-deep-blue font-semibold text-sm">Level</Label>
          <Select value={form.experience_level} onValueChange={v => setForm(f => ({ ...f, experience_level: v }))}>
            <SelectTrigger className="bg-paper border-gold-primary/50 font-body text-sm text-deep-blue">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !form.placement_key || !form.text || !form.tone || !form.experience_level || form.text.length > MAX_CHARS}
        className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold tracking-wide rounded-xl h-11"
      >
        {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
        Submit for Review ✦
      </Button>
    </form>
  );
}