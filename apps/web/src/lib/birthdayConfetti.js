import confetti from 'canvas-confetti';

const GOLD = '#D4AF85';
const GOLD2 = '#C9A961';
const CREAM = '#FDFBF7';
const SOFT_BLUE = '#9DB4C8';

const COLORS = [GOLD, GOLD2, CREAM, SOFT_BLUE];

/**
 * Fires a multi-stage golden confetti burst.
 * Safe to call repeatedly — each call is independent.
 */
export function fireBirthdayConfetti() {
  // Center burst
  confetti({
    particleCount: 80,
    spread: 100,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.5 },
    colors: COLORS,
    scalar: 1.1,
  });

  // Side cannons — staggered
  const fireSide = (x) =>
    confetti({
      particleCount: 50,
      angle: x < 0.5 ? 60 : 120,
      spread: 70,
      startVelocity: 55,
      origin: { x, y: 0.7 },
      colors: COLORS,
      scalar: 1.0,
    });

  const t1 = setTimeout(() => fireSide(0.2), 300);
  const t2 = setTimeout(() => fireSide(0.8), 500);
  const t3 = setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 120,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.4 },
      colors: COLORS,
      scalar: 0.9,
    });
  }, 800);

  return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
}