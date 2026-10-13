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

// Element styling is explicit rather than Tailwind `prose-*` utilities:
// @tailwindcss/typography is not installed in this project, so every prose
// class is a no-op — which is the other half of why generated headers showed
// as plain body text (B-12). Sizes are in em so each surface's own font size
// still drives them.
const HEADING = 'font-display text-gold-accent font-bold mt-3 mb-1 leading-snug';

export default function InterpretationMarkdown({ text, className = '', onHighlightTransit = null, highlightClass = 'text-gold-accent' }) {
  if (!text) return null;
  const hl = (children) => highlightAstro(children, onHighlightTransit, highlightClass);
  const components = {
    p: ({ children }) => <p className="my-1.5">{hl(children)}</p>,
    ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{hl(children)}</li>,
    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    h1: ({ children }) => <h1 className={`${HEADING} text-[1.2em]`}>{hl(children)}</h1>,
    h2: ({ children }) => <h2 className={`${HEADING} text-[1.15em]`}>{hl(children)}</h2>,
    h3: ({ children }) => <h3 className={`${HEADING} text-[1.1em]`}>{hl(children)}</h3>,
    h4: ({ children }) => <h4 className={`${HEADING} text-[1.05em]`}>{hl(children)}</h4>,
  };
  return (
    <div className={className}>
      <ReactMarkdown components={components}>{normalizeInterpretation(text)}</ReactMarkdown>
    </div>
  );
}
