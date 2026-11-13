import React, { forwardRef } from 'react';

/**
 * The 1080×1080 shareable card. Rendered off-screen for html2canvas capture
 * and scaled down in the preview sheet. All text/copy is passed in via `card`.
 *
 * card shape:
 *  { glyph, glyphColor, kicker, title, bodyType: 'prose'|'bullets'|'dates'|'stats',
 *    body, bullets, dates: [{ date, text }], stats: [{ label, value }], badge,
 *    dateStr, format: 'square'|'story', audience: 'everyone'|'mine', cta }
 * F-04: `audience` adds the "Today's sky" / "My sky" label. F-05: `format:
 * 'story'` renders 1080×1920 for Stories. F-06: `stats` + `cta` (invite line).
 */
export const cardSize = (card) => (card?.format === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 });
const AUDIENCE_LABEL = { everyone: "TODAY'S SKY", mine: 'MY SKY' };
export const SHARE_CARD_THEMES = {
  blue: {
    background: 'radial-gradient(ellipse at center, #16243f 0%, #0f1a2e 72%)',
    text: '#D8CDA9', muted: '#C4A882', accent: '#C9A961',
    border: 'rgba(201,169,97,0.28)', innerBorder: 'rgba(201,169,97,0.14)',
    divider: 'rgba(201,169,97,0.25)', ornament: 'rgba(201,169,97,0.4)',
  },
  cream: {
    background: 'radial-gradient(ellipse at center, #FDFBF7 0%, #F3EDE2 72%)',
    text: '#2C3E50', muted: '#625441', accent: '#84632D',
    border: 'rgba(132,99,45,0.35)', innerBorder: 'rgba(132,99,45,0.18)',
    divider: 'rgba(132,99,45,0.3)', ornament: 'rgba(132,99,45,0.5)',
  },
};
const ShareCard = forwardRef(({ card, theme = 'blue' }, ref) => {
  if (!card) return null;

  const isBullets = card.bodyType === 'bullets' && Array.isArray(card.bullets) && card.bullets.length > 0;
  const isDates = card.bodyType === 'dates' && Array.isArray(card.dates) && card.dates.length > 0;
  const isStats = card.bodyType === 'stats' && Array.isArray(card.stats) && card.stats.length > 0;
  const { width, height } = cardSize(card);
  const audience = card.audienceLabel || AUDIENCE_LABEL[card.audience];
  const story = card.format === 'story';
  const palette = SHARE_CARD_THEMES[theme] || SHARE_CARD_THEMES.blue;

  return (
    <div ref={ref} style={{
      width,
      height,
      backgroundColor: theme === 'cream' ? '#FDFBF7' : '#0f1a2e',
      backgroundImage: palette.background,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '90px 100px',
      position: 'relative',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: 'Lora, Georgia, serif',
      color: palette.muted,
    }}>
      {/* Decorative double border */}
      <div style={{ position: 'absolute', inset: 34, border: `2px solid ${palette.border}`, borderRadius: 26, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 44, border: `1px solid ${palette.innerBorder}`, borderRadius: 20, pointerEvents: 'none' }} />

      {/* Faint corner ornaments */}
      <div style={{ position: 'absolute', top: 58, left: 68, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34, color: palette.ornament }}>✦</div>
      <div style={{ position: 'absolute', top: 58, right: 68, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34, color: palette.ornament }}>✦</div>

      {/* Audience label (F-04) */}
      {audience && (
        <p style={{
          position: 'absolute',
          top: 52,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'Lora, Georgia, serif',
          fontSize: 22,
          letterSpacing: '0.3em',
          whiteSpace: 'nowrap',
          color: '#0f1a2e',
          background: card.audience === 'mine' ? '#C9A961' : '#A8C4D4',
          borderRadius: 999,
          padding: '10px 30px',
          margin: 0,
        }}>{audience}</p>
      )}

      {/* Kicker */}
      {card.kicker && (
        <p style={{
          fontFamily: 'Lora, Georgia, serif',
          fontSize: 26,
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          color: palette.muted,
          opacity: 0.72,
          marginBottom: 30,
          textAlign: 'center',
        }}>{card.kicker}</p>
      )}

      {/* Glyph */}
      <div style={{
        fontFamily: "'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols 2', Symbola, serif",
        fontSize: 150,
        color: theme === 'cream' ? palette.accent : (card.glyphColor || palette.accent),
        lineHeight: 1,
        marginBottom: 34,
        textShadow: theme === 'cream' ? 'none' : '0 0 50px rgba(201,169,97,0.35)',
        fontVariantEmoji: 'text',
      }}>{card.glyph}</div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'Playfair Display, Georgia, serif',
        fontSize: 58,
        fontWeight: 700,
        color: palette.accent,
        textAlign: 'center',
        lineHeight: 1.18,
        marginBottom: 40,
        maxWidth: 860,
        margin: '0 0 40px 0',
      }}>{card.title}</h1>

      {/* Body */}
      {isDates ? (
        <div style={{ width: '100%', maxWidth: 860, margin: '0 0 50px' }}>
          {card.dates.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 30, alignItems: 'baseline', padding: story ? '24px 0' : '22px 0', borderTop: i ? `1px solid ${palette.innerBorder}` : 'none' }}>
              <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: story ? 40 : 34, color: palette.accent, minWidth: story ? 200 : 190, fontWeight: 700 }}>{d.date}</span>
              <span style={{ fontFamily: 'Lora, Georgia, serif', fontSize: story ? 40 : 34, lineHeight: 1.35, color: palette.text }}>{d.text}</span>
            </div>
          ))}
        </div>
      ) : isStats ? (
        <div style={{ width: '100%', maxWidth: 860, margin: story ? '0 0 50px' : '0 0 26px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(card.stats.length, 2)}, 1fr)`, gap: story ? 26 : 18 }}>
          {card.stats.map((st, i) => (
            <div key={i} style={{ border: `1px solid ${palette.border}`, borderRadius: 22, padding: story ? '28px 20px' : '16px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: story ? 64 : 52, fontWeight: 700, color: palette.accent, lineHeight: 1.1 }}>{st.value}</div>
              <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 24, letterSpacing: '0.16em', textTransform: 'uppercase', color: palette.muted, opacity: 0.75, marginTop: 10 }}>{st.label}</div>
            </div>
          ))}
          {card.badge && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontFamily: 'Lora, Georgia, serif', fontSize: 32, color: palette.text, marginTop: 8 }}>{card.badge}</div>
          )}
        </div>
      ) : isBullets ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 50px', maxWidth: 820, width: '100%' }}>
          {card.bullets.map((b, i) => (
            <li key={i} style={{
              fontFamily: 'Lora, Georgia, serif',
              fontSize: 30,
              lineHeight: 1.5,
              color: palette.text,
              marginBottom: 22,
              paddingLeft: 44,
              position: 'relative',
              textAlign: 'left',
            }}>
              <span style={{ position: 'absolute', left: 0, top: 0, color: palette.accent, fontSize: 28 }}>✦</span>
              {b}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{
          fontFamily: 'Lora, Georgia, serif',
          fontSize: 33,
          lineHeight: 1.6,
          color: palette.text,
          textAlign: 'center',
          maxWidth: 820,
          margin: '0 0 50px',
        }}>{card.body}</p>
      )}

      {/* Date */}
      <p style={{
        fontFamily: 'Lora, Georgia, serif',
        fontSize: 23,
        color: palette.muted,
        opacity: theme === 'cream' ? 0.9 : 0.62,
        letterSpacing: '0.12em',
        textAlign: 'center',
      }}>{card.dateStr}</p>

      {/* Watermark */}
      <div style={{ position: 'absolute', bottom: 56, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', borderTop: `1px solid ${palette.divider}`, paddingTop: 16, paddingLeft: 40, paddingRight: 40 }}>
          <p style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 30,
            color: palette.accent,
            letterSpacing: '0.18em',
            margin: 0,
          }}>✦ ASTROSETTA ✦</p>
          <p style={{
            fontFamily: 'Lora, Georgia, serif',
            fontSize: 19,
            color: palette.muted,
            opacity: theme === 'cream' ? 0.9 : 0.55,
            letterSpacing: '0.12em',
            margin: '6px 0 0',
          }}>{card.cta || 'astrosetta.com'}</p>
        </div>
      </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';
export default ShareCard;
