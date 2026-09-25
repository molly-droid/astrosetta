import React, { forwardRef } from 'react';

/**
 * The 1080×1080 shareable card. Rendered off-screen for html2canvas capture
 * and scaled down in the preview sheet. All text/copy is passed in via `card`.
 *
 * card shape:
 *  { glyph, glyphColor, kicker, title, bodyType: 'prose'|'bullets',
 *    body, bullets, dateStr }
 */
const ShareCard = forwardRef(({ card }, ref) => {
  if (!card) return null;

  const isBullets = card.bodyType === 'bullets' && Array.isArray(card.bullets) && card.bullets.length > 0;

  return (
    <div ref={ref} style={{
      width: 1080,
      height: 1080,
      background: 'radial-gradient(ellipse at center, #16243f 0%, #0f1a2e 72%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '90px 100px',
      position: 'relative',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: 'Lora, Georgia, serif',
      color: '#C4A882',
    }}>
      {/* Decorative double border */}
      <div style={{ position: 'absolute', inset: 34, border: '2px solid rgba(201,169,97,0.28)', borderRadius: 26, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 44, border: '1px solid rgba(201,169,97,0.14)', borderRadius: 20, pointerEvents: 'none' }} />

      {/* Faint corner ornaments */}
      <div style={{ position: 'absolute', top: 58, left: 68, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34, color: 'rgba(201,169,97,0.4)' }}>✦</div>
      <div style={{ position: 'absolute', top: 58, right: 68, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34, color: 'rgba(201,169,97,0.4)' }}>✦</div>

      {/* Kicker */}
      {card.kicker && (
        <p style={{
          fontFamily: 'Lora, Georgia, serif',
          fontSize: 26,
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          color: '#C4A882',
          opacity: 0.72,
          marginBottom: 30,
          textAlign: 'center',
        }}>{card.kicker}</p>
      )}

      {/* Glyph */}
      <div style={{
        fontFamily: "'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols 2', Symbola, serif",
        fontSize: 150,
        color: card.glyphColor || '#C9A961',
        lineHeight: 1,
        marginBottom: 34,
        textShadow: '0 0 50px rgba(201,169,97,0.35)',
        fontVariantEmoji: 'text',
      }}>{card.glyph}</div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'Playfair Display, Georgia, serif',
        fontSize: 58,
        fontWeight: 700,
        color: '#C9A961',
        textAlign: 'center',
        lineHeight: 1.18,
        marginBottom: 40,
        maxWidth: 860,
        margin: '0 0 40px 0',
      }}>{card.title}</h1>

      {/* Body */}
      {isBullets ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 50px', maxWidth: 820, width: '100%' }}>
          {card.bullets.map((b, i) => (
            <li key={i} style={{
              fontFamily: 'Lora, Georgia, serif',
              fontSize: 30,
              lineHeight: 1.5,
              color: '#D8CDA9',
              marginBottom: 22,
              paddingLeft: 44,
              position: 'relative',
              textAlign: 'left',
            }}>
              <span style={{ position: 'absolute', left: 0, top: 0, color: '#C9A961', fontSize: 28 }}>✦</span>
              {b}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{
          fontFamily: 'Lora, Georgia, serif',
          fontSize: 33,
          lineHeight: 1.6,
          color: '#D8CDA9',
          textAlign: 'center',
          maxWidth: 820,
          margin: '0 0 50px',
        }}>{card.body}</p>
      )}

      {/* Date */}
      <p style={{
        fontFamily: 'Lora, Georgia, serif',
        fontSize: 23,
        color: '#C4A882',
        opacity: 0.62,
        letterSpacing: '0.12em',
        textAlign: 'center',
      }}>{card.dateStr}</p>

      {/* Watermark */}
      <div style={{ position: 'absolute', bottom: 56, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', borderTop: '1px solid rgba(201,169,97,0.25)', paddingTop: 16, paddingLeft: 40, paddingRight: 40 }}>
          <p style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 30,
            color: '#C9A961',
            letterSpacing: '0.18em',
            margin: 0,
          }}>✦ ASTROSETTA ✦</p>
          <p style={{
            fontFamily: 'Lora, Georgia, serif',
            fontSize: 19,
            color: '#C4A882',
            opacity: 0.55,
            letterSpacing: '0.12em',
            margin: '6px 0 0',
          }}>astrosetta.com</p>
        </div>
      </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';
export default ShareCard;