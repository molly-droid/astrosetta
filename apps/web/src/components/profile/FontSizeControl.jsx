import React, { useState, useEffect } from 'react';
import { Type, Minus, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/** Persisted font-size scale: slider stored on user entity, applied via CSS variable. */
export default function FontSizeControl() {
  const { user } = useAuth();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const saved = user?.font_scale;
    const initial = typeof saved === 'number' && saved >= 0.8 && saved <= 1.8 ? saved : 1;
    setScale(initial);
    document.documentElement.style.setProperty('--app-font-scale', initial);
  }, [user]);

  const save = async (val) => {
    setScale(val);
    document.documentElement.style.setProperty('--app-font-scale', val);
    await base44.auth.updateMe({ font_scale: val });
  };

  const stepDown = () => save(Math.max(0.8, +(scale - 0.1).toFixed(1)));
  const stepUp = () => save(Math.min(1.8, +(scale + 0.1).toFixed(1)));

  return (
    <div className="celestial-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Type size={14} className="text-brass/60" />
        <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Font Size</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={stepDown}
          disabled={scale <= 0.8}
          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 transition-colors"
        >
          <Minus size={14} className="text-white/70" />
        </button>
        <input
          type="range"
          min="0.8"
          max="1.8"
          step="0.1"
          value={scale}
          onChange={e => save(+e.target.value)}
          className="flex-1 h-1.5 appearance-none rounded-full bg-white/[0.12] accent-gold-primary cursor-pointer"
        />
        <button
          onClick={stepUp}
          disabled={scale >= 1.8}
          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 transition-colors"
        >
          <Plus size={14} className="text-white/70" />
        </button>
      </div>
      <div className="flex justify-between font-body text-[0.625rem] text-white/40">
        <span>A</span>
        <span className="text-gold-accent">{(scale * 100).toFixed(0)}%</span>
        <span className="text-lg leading-none">A</span>
      </div>
    </div>
  );
}