import React from 'react';
import ReactMarkdown from 'react-markdown';
import { highlightGlyphs, highlightAllLabels } from '@/lib/transitUtils';

/**
 * Shared renderer for LLM interpretation text (B-12).
 *
 * Renders markdown (headers, bold, lists) with astrological terms highlighted
 * in gold inside every text node — the same approach MyChart's deep-dive body
 * uses, extracted so all interpretation surfaces get header styling instead of
 * raw "###"/plain-text section titles.
 *
 * Also repairs the model's most common format slip: a section title emitted
 * WITHOUT its "### " prefix (e.g. "🔍 Themes to Explore" on its own line) is
 * promoted to a header before rendering.
 */

// A line that is just an emoji + a short title (no sentence punctuation).
const BARE_HEADER_RE = /^(\p{Extended_Pictographic}️?\s+)([A-Z][^.!?:\n]{2,40})\s*$/u;

export function normalizeInterpretation(text) {
  if (typeof text !== 'string') return text;
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (BARE_HEADER_RE.test(t)) return `### ${t}`;
      return line;
    })
    .join('\n');
}

// Recursively highlights astrological terms (planets, signs, aspects) inside
// markdown children, rendering them in gold. Mirrors MyChart's highlightAstro:
// uses highlightGlyphs + highlightAllLabels directly rather than
// highlightSynthesisText, whose fragment-trimming collapses spaces around
// bolded terms.
function highlightAstro(node, onHighlightTransit, cls = 'text-gold-accent') {
  return React.Children.map(node, (child) => {
    if (typeof child === 'string') {
      if (!child.trim()) return child; // preserve whitespace-only text nodes
      const glyphed = highlightGlyphs(child, cls);
      if (typeof glyphed === 'string') return highlightAllLabels(glyphed, onHighlightTransit, cls);
      return glyphed.flatMap((part) => typeof part === 'string' ? highlightAllLabels(part, onHighlightTransit, cls) : part);
    }
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {}, highlightAstro(child.props.children, onHighlightTransit, cls));
    }
    return child;
  });
}

export default function InterpretationMarkdown({ text, className = '', onHighlightTransit = null, highlightClass = 'text-gold-accent' }) {
  if (!text) return null;
  const components = {
    p: ({ children }) => <p>{highlightAstro(children, onHighlightTransit, highlightClass)}</p>,
    li: ({ children }) => <li>{highlightAstro(children, onHighlightTransit, highlightClass)}</li>,
    h1: ({ children }) => <h1>{highlightAstro(children, onHighlightTransit, highlightClass)}</h1>,
    h2: ({ children }) => <h2>{highlightAstro(children, onHighlightTransit, highlightClass)}</h2>,
    h3: ({ children }) => <h3>{highlightAstro(children, onHighlightTransit, highlightClass)}</h3>,
    h4: ({ children }) => <h4>{highlightAstro(children, onHighlightTransit, highlightClass)}</h4>,
  };
  return (
    <div className={`prose prose-sm prose-invert max-w-none
      prose-headings:font-display prose-headings:text-gold-accent prose-headings:text-[1.05em] prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1
      prose-strong:text-white prose-strong:font-semibold
      prose-ul:pl-4 prose-li:leading-relaxed
      prose-p:my-1.5 ${className}`}>
      <ReactMarkdown components={components}>{normalizeInterpretation(text)}</ReactMarkdown>
    </div>
  );
}
