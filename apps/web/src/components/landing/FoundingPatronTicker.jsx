import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// The ticker only surfaces once the community reaches this many founding patrons.
const MIN_PATRONS = 10;

/**
 * FoundingPatronTicker — a full-width rotating thank-you strip for the
 * landing page. Each loop greets a founding member by first name or
 * username. Hidden until there are 10+ founding patrons.
 */
export default function FoundingPatronTicker() {
  const [names, setNames] = useState(null);

  useEffect(() => {
    let cancelled = false;
    base44.entities.FoundingPatron.list('-created_date', 50)
      .then(records => {
        if (!cancelled) setNames(records.map(r => r.display_name).filter(Boolean));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!names || names.length < MIN_PATRONS) return null;

  // Duplicate the list so the marquee loops seamlessly (each item carries
  // its own trailing space, so one list copy is exactly half the track).
  const items = [...names, ...names];

  return (
    <div
      className="relative overflow-hidden py-3 border-y"
      style={{ borderColor: 'rgba(201,169,97,0.2)', background: 'rgba(201,169,97,0.06)' }}
    >
      <div
        className="flex w-max animate-marquee items-center whitespace-nowrap"
        style={{ animationDuration: `${Math.max(names.length * 5, 30)}s` }}
      >
        {items.map((name, i) => (
          <span
            key={i}
            className="flex items-center gap-2 pr-10 font-body text-xs"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            <span style={{ color: '#C9A961' }}>✦</span>
            Thank you for being a founding member,
            <span className="font-semibold" style={{ color: '#C9A961' }}>{name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}