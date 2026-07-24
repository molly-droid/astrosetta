// Test Edge Function: Verify astronomy-engine works in Deno
// This tests if we can use astronomy-engine in Supabase Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    // Step 1: Verify basic Deno environment
    const now = new Date();

    // Step 2: Try importing astronomy-engine
    const Astronomy = await import('npm:astronomy-engine@2.1.19');

    // Step 3: Create an AstroTime
    const time = new Astronomy.AstroTime(now);

    // Step 4: Calculate Sun position (simpler API)
    const sunPos = Astronomy.SunPosition(time);

    // Step 5: Calculate Moon position
    const moonVec = Astronomy.GeoMoon(time);
    const moonEcl = Astronomy.Ecliptic(moonVec);

    const testData = {
      success: true,
      runtime: 'deno',
      denoVersion: Deno.version.deno,
      message: 'astronomy-engine is working in Edge Functions!',
      timestamp: now.toISOString(),
      sun: {
        ecliptic_lon: sunPos.elon,
        ecliptic_lat: sunPos.elat,
        distance_au: sunPos.vec.t,
      },
      moon: {
        ecliptic_lon: moonEcl.elon,
        ecliptic_lat: moonEcl.elat,
        distance_au: moonVec.t,
      },
    };

    return new Response(JSON.stringify(testData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
      }, null, 2),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
