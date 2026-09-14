import React from 'react';
import { Button } from '@/components/ui/button';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { ELEMENT_COLORS } from '@/lib/chartUtils';
import ChartWheel from '@/components/chart/ChartWheel';

// Ruling planet per sign
const SIGN_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};

const ELEMENT_ORDER = ['fire', 'earth', 'air', 'water'];

export default function ChartSummaryPreview({ chartData, sunSign, moonSign, ascSign, placementKeys, onStartLearning }) {

  const rawElements = chartData?.element_distribution || {};
  const total = Object.values(rawElements).reduce((s, v) => s + v, 0) || 1;
  // Build sorted element list by value desc
  const elementRows = ELEMENT_ORDER
    .filter(el => rawElements[el] > 0)
    .map(el => ({ el, pct: Math.round((rawElements[el] / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const rulingPlanet = SIGN_RULERS[ascSign] || SIGN_RULERS[sunSign] || null;



  return (
    <div className="space-y-5 animate-fade-up">
      {/* Sun / Moon / Rising + Ruling Planet */}
      <div className="celestial-card p-5 space-y-4">
        <h3 className="font-display text-lg text-white text-center">Your Cosmic Signature</h3>
        <OrnamentDivider />
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { glyph: '☉', label: 'Sun', value: sunSign },
            { glyph: '☽', label: 'Moon', value: moonSign },
            { glyph: 'AC', label: 'Rising', value: ascSign },
          ].map(({ glyph, label, value }) => (
            <div key={label} className="space-y-1">
              <div className="text-2xl text-gold-accent font-display">{glyph}</div>
              <div className="text-[10px] font-body uppercase tracking-widest text-brass">{label}</div>
              <div className="text-sm font-display font-bold text-white">{value || '—'}</div>
            </div>
          ))}
        </div>
        {rulingPlanet && (
          <div className="flex items-center justify-center gap-2 pt-1 border-t border-gold-primary/15">
            <span className="font-body text-[10px] text-brass uppercase tracking-widest">Chart Ruler</span>
            <span className="font-display text-sm font-bold text-gold-accent">{rulingPlanet}</span>
          </div>
        )}
      </div>

      {/* Chart Wheel */}
      {chartData && (
        <div className="celestial-card p-3">
          <ChartWheel chartData={chartData} />
        </div>
      )}

      {/* Elemental Balance — individual rows */}
      {elementRows.length > 0 && (
        <div className="celestial-card p-5 space-y-3">
          <h3 className="font-display text-sm text-white uppercase tracking-widest">Elemental Balance</h3>
          <div className="space-y-2.5">
            {elementRows.map(({ el, pct }) => (
              <div key={el} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-brass capitalize">{el.charAt(0).toUpperCase() + el.slice(1)}</span>
                  <span className="font-body text-xs text-brass/60">{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: ELEMENT_COLORS[el] || '#D4AF85' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={onStartLearning}
        className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-base tracking-wide rounded-xl h-12 shadow-sm transition-all"
      >
        Begin Your Study ✦
      </Button>
    </div>
  );
}