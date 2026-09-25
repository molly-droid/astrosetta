// Supabase-backed replacement for the Base44 SDK client.
//
// Every feature module imports { base44 } from here and uses
// base44.entities / auth / functions / integrations / agents — the shim
// keeps that exact surface so call sites stay untouched while the backend
// moves to Supabase. See src/api/shim/* for each area's mapping.
import { entities } from './shim/entities.js';
import { auth } from './shim/auth.js';
import { functions } from './shim/functions.js';
import { integrations } from './shim/integrations.js';
import { agents } from './shim/agents.js';
import { supabase } from './shim/supabase.js';

export const base44 = {
  entities,
  auth,
  functions,
  integrations,
  agents,

  // Admin "invite user" — needs a service-role Edge Function.
  users: {
    invite: (email, role) =>
      functions.invoke('adminInviteUser', { email, role }).then((r) => r.data),
    inviteUser: (email, role) =>
      functions.invoke('adminInviteUser', { email, role }).then((r) => r.data),
  },

  // Base44 hosted analytics has no replacement yet; keep the call sites
  // working. Wire to a real product-analytics provider if the client adds one.
  analytics: {
    track: () => {},
  },
};

// Direct access for new (non-shim) code being written during the migration.
export { supabase };
