import React, { useState } from 'react';
import { Loader2, Mail, ShieldAlert, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { publicAppOrigin } from '@/lib/appUrls';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

const LOST_ITEMS = [
  'Your natal chart and all saved charts (people and events)',
  'Daily, weekly, and monthly readings — including saved ones',
  'Quiz history, streaks, XP, and learning progress',
  'Journal entries and planner notes',
  'Saved interpretations and your community contributions',
];

/**
 * Security & Privacy card on the Profile Details tab with the Apple-required
 * Delete Account action. Two-step warning flow (what's lost → email confirm);
 * on mobile it renders as a bottom drawer, on desktop as a centered dialog.
 * Deletion itself only happens after the user clicks the emailed link.
 */
export default function DeleteAccountSection() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('warning'); // warning | confirm | sent
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const close = () => {
    setOpen(false);
    setStep('warning');
    setError(null);
  };

  const startDeletion = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    // The emailed link must open in a real browser — on native builds the
    // in-app origin isn't reachable, so fall back to the published web app.
    const origin = publicAppOrigin();
    try {
      await base44.functions.invoke('accountDeletion', { action: 'request', origin });
      setStep('sent');
    } catch {
      setError("We couldn't send the confirmation email just now. Please try again.");
    }
    setSending(false);
  };

  const content = (
    <div className="bg-velvet text-starlight">
      {/* Signature red-gold stroke */}
      <div className="h-[2px] w-full bg-gradient-to-r from-gold-foil via-danger-red to-gold-foil" />
      <div className="px-5 pt-4 pb-5 relative">
        <button onClick={close} className="absolute top-4 right-4 text-starlight-muted hover:text-starlight transition-colors">
          <X size={16} />
        </button>

        {step === 'warning' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-danger-red/15 border border-danger-red/40 flex items-center justify-center shrink-0">
                <ShieldAlert size={15} className="text-danger-red" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-starlight leading-tight pr-6">
                Delete your account?
              </h2>
            </div>
            <p className="font-body text-[15px] leading-[22px] text-starlight-muted">
              This permanently erases everything you've built in Astrosetta:
            </p>
            <ul className="space-y-1.5">
              {LOST_ITEMS.map(item => (
                <li key={item} className="flex items-start gap-2 font-body text-xs leading-snug text-starlight-muted">
                  <X size={12} className="text-danger-red mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="font-body text-[11px] leading-snug text-starlight-muted/70 italic">
              Only anonymous aggregate usage stats are kept — nothing in them can be linked back to you.
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              <button onClick={close} className="flex-1 bg-gold-foil hover:bg-gold-foil/90 text-velvet font-body text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
                Keep my account
              </button>
              <button onClick={() => setStep('confirm')} className="flex-1 border border-danger-red/60 text-danger-red hover:bg-danger-red/10 font-body text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4 pt-1">
            <h2 className="font-display text-2xl font-semibold text-starlight leading-tight pr-6">
              Last step — confirm by email
            </h2>
            <p className="font-body text-[15px] leading-[22px] text-starlight-muted">
              We'll send a deletion link to <span className="text-starlight font-semibold">{user?.email}</span>.
              Nothing is deleted until you open that link and confirm — and it expires in 24 hours.
            </p>
            {error && <p className="font-body text-xs text-danger-red">{error}</p>}
            <div className="flex items-center gap-2.5 pt-1">
              <button onClick={() => setStep('warning')} className="flex-1 border border-gold-hairline text-starlight-muted hover:text-starlight font-body text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
                Back
              </button>
              <button onClick={startDeletion} disabled={sending} className="flex-1 flex items-center justify-center gap-1.5 bg-danger-red hover:bg-danger-red/90 text-starlight font-body text-xs font-semibold px-4 py-2.5 rounded-full transition-colors disabled:opacity-50">
                {sending ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : 'Email me the link'}
              </button>
            </div>
          </div>
        )}

        {step === 'sent' && (
          <div className="space-y-4 pt-2 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-gold-muted border border-gold-hairline flex items-center justify-center">
              <Mail size={20} className="text-gold-foil" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-starlight">Check your inbox</h2>
            <p className="font-body text-[15px] leading-[22px] text-starlight-muted">
              We sent a confirmation link to <span className="text-starlight font-semibold">{user?.email}</span>.
              Tap it within 24 hours to permanently delete your account.
            </p>
            <button onClick={close} className="w-full bg-gold-foil hover:bg-gold-foil/90 text-velvet font-body text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="celestial-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldAlert size={14} className="text-danger-red" />
          <div>
            <p className="font-label text-xs font-medium uppercase tracking-[0.05em] text-starlight-muted">Security &amp; Privacy</p>
            <p className="font-body text-sm text-starlight">Delete Account</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="font-label text-xs font-medium uppercase tracking-[0.05em] text-danger-red border border-danger-red/40 rounded-full px-3.5 py-1.5 hover:bg-danger-red/10 transition-colors"
        >
          Delete
        </button>
      </div>

      {open && (
        isMobile ? (
          <Drawer open={open} onOpenChange={o => { if (!o) close(); }}>
            <DrawerContent className="bg-velvet border-t border-gold-hairline">
              {content}
            </DrawerContent>
          </Drawer>
        ) : (
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/80 px-4 py-4" onClick={close}>
            <div
              className="w-full sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-2xl border border-gold-hairline shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {content}
            </div>
          </div>
        )
      )}
    </>
  );
}
