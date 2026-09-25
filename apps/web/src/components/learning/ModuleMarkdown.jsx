import React from 'react';
import ReactMarkdown from 'react-markdown';
import GlossyTerm from '@/components/ui/GlossyTerm';

// Curated technical terms → glossary key. These appear mainly in the
// classical_techniques, traditions, dynamics, and aspects modules, so
// auto-linking them stays focused and doesn't clutter planet/sign prose.
const TERM_ENTRIES = [
  ['essential dignities', 'essential dignity'],
  ['essential dignity', 'essential dignity'],
  ['part of fortune', 'part of fortune'],
  ['part of spirit', 'part of spirit'],
  ['whole sign', 'whole sign'],
  ['nodal axis', 'nodal axis'],
  ['nakshatras', 'nakshatra'],
  ['nakshatra', 'nakshatra'],
  ['conjunctions', 'conjunction'],
  ['conjunction', 'conjunction'],
  ['oppositions', 'opposition'],
  ['opposition', 'opposition'],
  ['quincunxes', 'quincunx'],
  ['quincunx', 'quincunx'],
  ['sextiles', 'sextile'],
  ['sextile', 'sextile'],
  ['trines', 'trine'],
  ['trine', 'trine'],
  ['squares', 'square'],
  ['square', 'square'],
  ['stelliums', 'stellium'],
  ['stellium', 'stellium'],
  ['transits', 'transit'],
  ['transit', 'transit'],
  ['ingresses', 'ingress'],
  ['ingress', 'ingress'],
  ['ascendant', 'ascendant'],
  ['midheaven', 'midheaven'],
  ['descendant', 'descendant'],
  ['domicile', 'domicile'],
  ['detriment', 'detriment'],
  ['exaltation', 'exaltation'],
  ['peregrine', 'peregrine'],
  ['dispositor', 'dispositor'],
  ['bonification', 'bonification'],
  ['triplicity', 'triplicity'],
  ['dashas', 'dasha'],
  ['dasha', 'dasha'],
  ['ayanamsa', 'ayanamsa'],
  ['cazimi', 'cazimi'],
  ['combustion', 'combust'],
  ['combust', 'combust'],
  ['under the beams', 'under the beams'],
  ['void of course', 'void of course'],
  ['antiscia', 'antiscion'],
  ['antiscion', 'antiscion'],
  ['contrascia', 'contrascion'],
  ['contrascion', 'contrascion'],
  ['decans', 'decan'],
  ['decan', 'decan'],
  ['semisextile', 'semisextile'],
  ['sesquiquadrate', 'sesquiquadrate'],
  ['profections', 'profection'],
  ['profection', 'profection'],
  ['bhavas', 'bhava'],
  ['bhava', 'bhava'],
  ['sect', 'sect'],
  ['hayz', 'hayz'],
  ['sidereal zodiac', 'sidereal zodiac'],
  ['sidereal', 'sidereal zodiac'],
  ['orbs', 'orb'],
  ['orb', 'orb'],
  ['retrograde', 'retrograde'],
  ['Lots', 'lots'],
];

// Sort longest-first so multi-word phrases win over their component words
// (e.g. "essential dignity" before "dignity").
const SORTED = [...TERM_ENTRIES].sort((a, b) => b[0].length - a[0].length);
const LOWER_TO_KEY = new Map(SORTED.map(([t, k]) => [t.toLowerCase(), k]));
const PATTERN = new RegExp(
  '\\b(?:' + SORTED.map(([t]) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'gi'
);

// "Lots" is a real Hellenistic term but lowercase "lots" (as in "lots of")
// is a common phrase — only link the capitalized form.
function wrap(match) {
  const key = LOWER_TO_KEY.get(match.toLowerCase());
  if (!key) return match;
  if (key === 'lots' && match !== 'Lots') return match;
  return `[${match}](glossary:${key})`;
}

function linkTerms(markdown) {
  if (!markdown) return markdown;
  // Protect inline code spans and existing markdown links so we never nest
  // a glossary link inside another link or inside code.
  const stash = [];
  const protect = (m) => { stash.push(m); return `\u0000${stash.length - 1}\u0000`; };
  let out = markdown.replace(/`[^`]*`/g, protect);
  out = out.replace(/\[([^\]]*)\]\(([^)]*)\)/g, protect);
  out = out.replace(PATTERN, wrap);
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
  return out;
}

const components = {
  a: ({ href, children, node, ...props }) => {
    if (href && href.startsWith('glossary:')) {
      return <GlossyTerm term={href.slice(9)}>{children}</GlossyTerm>;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
  },
};

export default function ModuleMarkdown({ children }) {
  return <ReactMarkdown components={components}>{linkTerms(children)}</ReactMarkdown>;
}