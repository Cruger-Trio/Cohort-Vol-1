import { createClient } from '@supabase/supabase-js';

/** Load only the public project URL and anon key from the server config route. */
export async function connectSupabase() {
  const response = await fetch('/api/public-config', { cache: 'no-store' });
  const config = await response.json();
  if (!response.ok) throw new Error(config.error || 'Unable to load Supabase configuration.');
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}
