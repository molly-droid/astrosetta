import React from 'react';
import { SIGN_GLYPHS } from '@/lib/chartUtils';

/**
 * Renders a zodiac sign name with its glyph/symbol,
 * using font-variant-emoji: text to prevent emoji rendering.
 * Usage: <SignName sign="Cancer" /> → ♋︎ Cancer
 */
export default function SignName({ sign, glyphClassName = '', nameClassName = '', className = '' }) {
  if (!sign) return null;
  const glyph = SIGN_GLYPHS[sign];
  return (
    <span className={className}>
      {glyph && (
        <span
          className={`text-[150%] ${glyphClassName}`}
          style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}
        >
          {glyph}{' '}
        </span>
      )}
      <span className={nameClassName}>{sign}</span>
    </span>
  );
}