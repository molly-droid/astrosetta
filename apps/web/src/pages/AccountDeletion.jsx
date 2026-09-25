import React, { useEffect, useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * /delete-account?token=... — the destination of the emailed deletion link.
 * Works whether or not the visitor is signed in (the link may open in a fresh
 * browser). Calls the confirm action once; shows a goodbye state on success,
 * or a clear invalid/expired message on failure.
 */
export default function AccountDeletion() {
  const [state, setState] = useState('verifying'); // verifying | done | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (!token) {
      setState('error');
      setMessage('This link is missing its confirmation token. Request a fresh deletion link from Profile → Delete Account.');
      return;
    }
    base44.functions.invoke('accountDeletion', { action: 'confirm', token })
      .then(() => setState('done'))
      .catch((err) => {
        setState('error');
        setMessage(err?.response?.data?.error || 'Something went wrong confirming your deletion. Please try again.');
      });
  }, []);

  const returnHome = async () => {
    try { await base44.auth.logout('/'); } catch { window.location.href = '/'; }
  };

  return (
    <div className="min-h-screen bg-velvet flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-gold-hairline bg-velvet-card p-6 text-center space-y-4">
        {state === 'verifying' && (
          <>
            <div className="text-3xl text-gold-foil font-display animate-pulse">✦</div>
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-gold-foil" />
              <p className="font-body text-[15px] leading-[22px] text-starlight-muted">Confirming your deletion…</p>
            </div>
          </>
        )}

        {state === 'done' && (
          <>
            <div className="text-3xl text-gold-foil font-display">✦</div>
            <h1 className="font-display font-semibold text-starlight" style={{ fontSize: 32, lineHeight: '40px' }}>
              Your account has been deleted
            </h1>
            <p className="font-body text-[15px] leading-[22px] text-starlight-muted">
              Everything personal — your charts, readings, journal, and learning progress — has been permanently
              erased. Only anonymous aggregate usage stats remain, and nothing in them can be linked back to you.
            </p>
            <button
              onClick={returnHome}
              className="w-full bg-gold-foil hover:bg-gold-foil/90 text-velvet font-body text-sm font-semibold px-4 py-3 rounded-full transition-colors"
            >
              Return to Astrosetta
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-danger-red/15 border border-danger-red/40 flex items-center justify-center">
                <XCircle size={22} className="text-danger-red" />
              </div>
            </div>
            <h1 className="font-display font-semibold text-starlight" style={{ fontSize: 24, lineHeight: '32px' }}>
              This link didn't work
            </h1>
            <p className="font-body text-[15px] leading-[22px] text-starlight-muted">{message}</p>
            <button
              onClick={returnHome}
              className="w-full bg-gold-foil hover:bg-gold-foil/90 text-velvet font-body text-sm font-semibold px-4 py-3 rounded-full transition-colors"
            >
              Return to Astrosetta
            </button>
          </>
        )}
      </div>
    </div>
  );
}