// Base44 backend functions -> Supabase Edge Functions.
//
// Function names keep their Base44 camelCase in app code and map to
// kebab-case Edge Function slugs (chartCalculator -> chart-calculator).
// Returns an axios-like { data, status } because call sites read res.data.
import { supabase } from './supabase.js';

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export const functions = {
  async invoke(name, payload) {
    const { data, error } = await supabase.functions.invoke(kebab(name), {
      body: payload ?? {},
    });
    if (error) {
      const err = new Error(error.message || `Function ${name} failed`);
      err.status = error.context?.status || 500;
      err.data = error;
      throw err;
    }
    return { data, status: 200 };
  },
};
