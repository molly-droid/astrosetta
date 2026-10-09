import { useEffect } from 'react';
import { getSolarReturnInfo } from '@/lib/solarReturn';
import { fireBirthdayConfetti } from '@/lib/birthdayConfetti';

/**
 * Fires birthday confetti every time the app is opened on the user's birthday.
 * No localStorage gate — fires on every mount when isBirthday is true.
 */
export default function BirthdayConfetti({ chart }) {
  useEffect(() => {
    if (!chart) return;
    const sr = getSolarReturnInfo(new Date(), chart);
    if (!sr.isBirthday) return;
    return fireBirthdayConfetti();
  }, [chart]);

  return null;
}