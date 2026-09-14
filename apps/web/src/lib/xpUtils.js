import { base44 } from '@/api/base44Client';

export const XP_AMOUNTS = {
  daily_quiz_completed: 10,
  card_completed: 10,
  first_chart: 50,
  interpretation_submitted: 25,
  interpretation_rated_up: 50,
  mastery_completed: 100,
};

export const LEVELS = [
  { name: 'apprentice', min: 0, max: 199, label: 'Apprentice' },
  { name: 'adept', min: 200, max: 499, label: 'Adept' },
  { name: 'practitioner', min: 500, max: 1499, label: 'Practitioner' },
  { name: 'sage', min: 1500, max: Infinity, label: 'Sage' },
];

export function getLevelFromXP(xp) {
  return LEVELS.find(l => xp >= l.min && xp <= l.max) || LEVELS[0];
}

export function getNextLevel(xp) {
  const currentIndex = LEVELS.findIndex(l => xp >= l.min && xp <= l.max);
  return LEVELS[currentIndex + 1] || null;
}

export function getLevelProgress(xp) {
  const current = getLevelFromXP(xp);
  const next = getNextLevel(xp);
  if (!next) return 100;
  const range = next.min - current.min;
  const progress = xp - current.min;
  return Math.min(Math.round((progress / range) * 100), 100);
}

export async function awardXP(userId, eventType, amount, referenceId = null, currentLevel = null) {
  await base44.entities.XPEvent.create({
    user_id: userId,
    event_type: eventType,
    xp_amount: amount,
    reference_id: referenceId,
  });
  // Sum all XP events to compute total (avoids stale me() cache)
  const events = await base44.entities.XPEvent.filter({ user_id: userId });
  const totalXP = events.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
  const newLevel = getLevelFromXP(totalXP).name;
  await base44.auth.updateMe({ xp_total: totalXP, level: newLevel });
  const leveledUp = currentLevel && newLevel !== currentLevel;
  return { totalXP, leveledUp, newLevel, oldLevel: currentLevel };
}