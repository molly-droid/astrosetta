// Test Edge Function: Verify astronomy-engine works in Deno
// This tests if we can use astronomy-engine in Supabase Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    // Try to import astronomy-engine
    // Note: This is a test - we'll need to properly bundle @astro/core later
    const testData = {
      runtime: 'deno',
      denoVersion: Deno.version.deno,
      message: 'Edge Function is working',
      timestamp: new Date().toISOString(),
    };

    // For now, we're just testing the runtime
    // Next step: Try importing astronomy-engine via npm specifier
    // import * as Astronomy from 'npm:astronomy-engine@2.1.19';

    return new Response(JSON.stringify(testData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
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
