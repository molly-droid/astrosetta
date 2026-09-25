import React from 'react';

export default function OrnamentDivider({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold-primary/40" />
      <span className="text-gold-accent text-xs font-display">✦</span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold-primary/40" />
    </div>
  );
}