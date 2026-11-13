import React from 'react';
import { isNativePlatform } from '@/lib/platform';

export default function GooglePlayBadge() {
  if (isNativePlatform()) return null;

  return (
    <a
      href="https://play.google.com/store/apps/details?id=com.astrosetta.app"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <img
        src="/brand/google-play-badge-en.png"
        alt="Get Astrosetta on Google Play"
        width="646"
        height="250"
        className="block h-auto w-[184px]"
      />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
