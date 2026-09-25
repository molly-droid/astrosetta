import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';

export default function SynastryTour({ steps, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    let cancelled = false;
    setTargetRect(null);

    const currentStep = stepsRef.current[stepIndex];
    if (currentStep?.onEnter) currentStep.onEnter();

    const findAndSet = (shouldScroll) => {
      if (cancelled) return;
      const el = currentStep?.selector ? document.querySelector(currentStep.selector) : null;
      if (el) {
        if (shouldScroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
        }
      }
    };

    const scrollTimer = setTimeout(() => findAndSet(true), 400);
    const tracker = setInterval(() => findAndSet(false), 250);

    return () => {
      cancelled = true;
      clearTimeout(scrollTimer);
      clearInterval(tracker);
    };
  }, [stepIndex]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onComplete?.();
  };

  const step = steps[stepIndex];

  const tooltipStyle = (() => {
    if (!targetRect) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '290px' };
    }
    const tooltipWidth = 290;
    const margin = 12;
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const below = spaceBelow > 260;
    const left = Math.max(margin, Math.min(
      targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
      window.innerWidth - tooltipWidth - margin
    ));
    if (below) {
      return { position: 'fixed', top: `${targetRect.bottom + margin}px`, left: `${left}px`, width: `${tooltipWidth}px` };
    }
    return { position: 'fixed', top: `${targetRect.top - margin}px`, left: `${left}px`, width: `${tooltipWidth}px`, transform: 'translateY(-100%)' };
  })();

  return (
    <div className="fixed inset-0 z-[10001]">
      {targetRect ? (
        <div
          className="fixed pointer-events-auto"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: '10px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            border: '2px solid #D4AF85',
            transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
          }}
          onClick={handleSkip}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55 pointer-events-auto" onClick={handleSkip} />
      )}

      <div style={tooltipStyle} className="pointer-events-auto animate-fade-up">
        <div className="rounded-xl border border-gold-primary/40 shadow-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a2847, #0f1a2e)' }}>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-[10px] text-gold-accent font-semibold uppercase tracking-widest">
                {stepIndex + 1} of {steps.length}
              </span>
              <button onClick={handleSkip} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                <X size={12} className="text-brass/50" />
              </button>
            </div>
            <h3 className="font-display text-base font-bold text-cream mb-1.5">{step?.title}</h3>
            <p className="font-body text-xs text-brass/80 leading-relaxed mb-3">{step?.body}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === stepIndex ? 'bg-gold-primary' : 'bg-white/15'}`} />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-body text-xs font-semibold transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #D4AF85, #C9A961)', color: '#0f1a2e' }}
              >
                {stepIndex < steps.length - 1 ? 'Next' : 'Got it'}
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}