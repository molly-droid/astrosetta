import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function EphemerisCheckTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await base44.functions.invoke('crossCheckEphemeris', {});
      setResult(resp.data);
    } catch (e) {
      setError(e.message || 'Failed to run cross-check');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="celestial-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-display text-sm font-bold text-white">Ephemeris Cross-Check</p>
            <p className="font-body text-xs text-white/50 mt-0.5">
              Compares our planetary positions against Swiss Ephemeris (Astro-Seek)
            </p>
          </div>
          <Button size="sm" onClick={runCheck} disabled={loading}>
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span className="ml-1">{loading ? 'Checking...' : 'Run Check'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="celestial-card p-3 border border-red-500/30">
          <p className="font-body text-xs text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="celestial-card p-3">
            <div className="flex items-center gap-2 mb-1">
              {Math.abs(result.max_error?.degrees || 0) < 0.5 ? (
                <CheckCircle size={14} className="text-green-400" />
              ) : Math.abs(result.max_error?.degrees || 0) < 1.0 ? (
                <AlertTriangle size={14} className="text-yellow-400" />
              ) : (
                <XCircle size={14} className="text-red-400" />
              )}
              <p className="font-body text-xs text-white/70">
                Reference: {result.reference_source}
              </p>
            </div>
            <p className="font-body text-[11px] text-white/50">
              Checked at {result.reference_time} · Max error: {result.max_error?.planet} {result.max_error?.degrees?.toFixed(3)}°
              {result.corrections_stored ? ' · Corrections stored' : ' · Not stored'}
            </p>
          </div>

          <div className="space-y-1.5">
            {result.summary?.map((line, i) => {
              const isMismatch = line.includes('SIGN MISMATCH');
              const diffMatch = line.match(/diff=(-?[\d.]+)°/);
              const diff = diffMatch ? parseFloat(diffMatch[1]) : 0;
              const isGood = Math.abs(diff) < 0.1;
              const isWarn = !isGood && Math.abs(diff) < 0.5;

              return (
                <div
                  key={i}
                  className={`celestial-card p-2.5 flex items-center justify-between ${
                    isMismatch ? 'border border-red-500/40' : ''
                  }`}
                >
                  <p className="font-body text-[11px] text-white/80">{line}</p>
                  {isMismatch && <XCircle size={12} className="text-red-400 shrink-0 ml-2" />}
                  {!isMismatch && isGood && <CheckCircle size={12} className="text-green-400 shrink-0 ml-2" />}
                  {!isMismatch && isWarn && <AlertTriangle size={12} className="text-yellow-400 shrink-0 ml-2" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}