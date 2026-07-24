/**
 * @astro/shared - Shared business logic
 * Used by both web and mobile apps
 */

// Re-export from @astro/core
// TODO: Re-enable when @astro/core builds successfully
// export * from '@astro/core';

// Supabase client
export * from './supabase/index.js';

// React hooks
export * from './hooks/index.js';

// Utilities
export * from './utils/index.js';
