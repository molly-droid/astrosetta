import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Bug, Lightbulb, MessageSquare, Loader2, CheckCircle2, Upload, X, Camera } from 'lucide-react';

const TYPE_OPTIONS = [
  { key: 'bug', label: 'Bug Report', icon: Bug, color: '#D8B4C2' },
  { key: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: '#A8C8A8' },
  { key: 'general', label: 'General Feedback', icon: MessageSquare, color: '#C9A961' },
];

export default function FeedbackTab() {
  const [type, setType] = useState('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      setScreenshotUrl(res.file_url);
    } catch (err) {
      setError('Failed to upload screenshot: ' + (err?.message || 'unknown error'));
    }
    setUploading(false);
  };

  const removeScreenshot = () => setScreenshotUrl(null);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      setError('Please provide both a subject and description.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await base44.entities.Feedback.create({
        type,
        subject: subject.trim(),
        description: description.trim(),
        screenshot_url: screenshotUrl || undefined,
        page_url: window.location.pathname,
      });
      setSubmitted(true);
      setSubject('');
      setDescription('');
      setScreenshotUrl(null);
      setType('bug');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="celestial-card p-6 text-center space-y-3">
        <CheckCircle2 size={32} className="text-green-soft mx-auto" />
        <p className="font-display text-base font-bold text-white">Thank you!</p>
        <p className="font-body text-sm text-white/60 leading-relaxed">
          Your feedback has been submitted. We read every report — this helps make Astrosetta better for everyone.
        </p>
        <Button
          onClick={() => setSubmitted(false)}
          variant="outline"
          className="border-gold-primary/30 text-white font-body text-xs"
        >
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="celestial-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gold-accent font-display text-xl">✦</span>
          <p className="font-display text-base font-bold text-white">Feedback</p>
        </div>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          Found a bug? Have an idea? Want to share thoughts? Your feedback directly shapes what gets built next.
        </p>
      </div>

      <div className="celestial-card p-4 space-y-4">
        {/* Type selector */}
        <div className="space-y-2">
          <p className="font-body text-[10px] uppercase tracking-widest text-brass">Type</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = type === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setType(opt.key)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                    active
                      ? 'border-gold-accent bg-gold-primary/10'
                      : 'border-white/[0.08] hover:border-gold-primary/30'
                  }`}
                >
                  <Icon size={18} style={{ color: active ? opt.color : 'rgba(255,255,255,0.4)' }} />
                  <span className="font-body text-[10px] text-center leading-tight" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <p className="font-body text-[10px] uppercase tracking-widest text-brass">Subject</p>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Brief summary..."
            maxLength={120}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 font-body text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-primary/40"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <p className="font-body text-[10px] uppercase tracking-widest text-brass">Description</p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={type === 'bug' ? 'What happened? What did you expect? Steps to reproduce...' : 'Tell us more...'}
            rows={5}
            maxLength={2000}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 font-body text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-primary/40 resize-none"
          />
        </div>

        {/* Screenshot upload */}
        <div className="space-y-1.5">
          <p className="font-body text-[10px] uppercase tracking-widest text-brass">Screenshot (optional)</p>
          {screenshotUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-gold-primary/20">
              <img src={screenshotUrl} alt="Screenshot" className="w-full max-h-48 object-contain bg-black/30" />
              <button
                onClick={removeScreenshot}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-white/[0.1] rounded-lg cursor-pointer hover:border-gold-primary/30 transition-colors">
              {uploading ? (
                <Loader2 size={20} className="animate-spin text-gold-primary" />
              ) : (
                <Camera size={20} className="text-white/30" />
              )}
              <span className="font-body text-xs text-white/40">
                {uploading ? 'Uploading...' : 'Tap to upload a screenshot'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleScreenshotUpload}
                className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
              />
            </label>
          )}
        </div>

        {error && (
          <p className="font-body text-xs text-red-400">{error}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting || !subject.trim() || !description.trim()}
          className="w-full bg-gold-primary/80 hover:bg-gold-primary text-deep-blue font-body text-sm h-10"
        >
          {submitting ? (
            <><Loader2 size={14} className="animate-spin mr-2" /> Submitting...</>
          ) : (
            <><Upload size={14} className="mr-2" /> Submit Feedback</>
          )}
        </Button>
      </div>
    </div>
  );
}