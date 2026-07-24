// Test Edge Function: Verify astronomy-engine works in Deno
// This tests if we can use astronomy-engine in Supabase Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as Astronomy from 'npm:astronomy-engine@2.1.19';

serve(async (req) => {
  try {
    // Test astronomy-engine by calculating current planetary positions
    const now = new Date();

    // Calculate positions for key planets
    const sun = Astronomy.EquatorFromEcl(
      Astronomy.SunPosition(now),
      now
    );

    const moon = Astronomy.EquatorFromEcl(
      Astronomy.GeoMoon(now),
      now
    );

    const mars = Astronomy.EquatorFromEcl(
      Astronomy.HelioVector('Mars', now),
      now
    );

    const testData = {
      success: true,
      runtime: 'deno',
      denoVersion: Deno.version.deno,
      message: 'astronomy-engine is working in Edge Functions!',
      timestamp: now.toISOString(),
      positions: {
        sun: {
          ra: sun.ra,
          dec: sun.dec,
          dist: sun.dist,
        },
        moon: {
          ra: moon.ra,
          dec: moon.dec,
          dist: moon.dist,
        },
        mars: {
          ra: mars.ra,
          dec: mars.dec,
          dist: mars.dist,
        },
      },
    };

    return new Response(JSON.stringify(testData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
