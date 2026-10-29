import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createSupabaseAuth, type SessionClient } from './auth';
import { createSupabaseReminders } from './reminders';
import type { Database } from './database.types';
import type { ProfileSource } from './profileSync';
import { createSupabaseRemote } from './sync/remote';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.',
  );
}

/** Where Supabase emails link back to (allow it in Supabase → Authentication → URL Configuration). */
export const SITE_URL = new URL(import.meta.env.BASE_URL, window.location.origin).href;

/**
 * Read before the client starts, because the client removes the token from the address bar.
 * A reset-password email lands here with `#…type=recovery`.
 */
export const openedFromRecoveryLink = window.location.hash.includes('type=recovery');

/**
 * The one Supabase client for the app.
 * Sessions persist in local storage and refresh silently, so you sign in once per device (ADR-004).
 * "implicit" flow: the reset email may open in Safari rather than the installed app,
 * and this flow works across both (the other flow needs the same browser that asked).
 */
export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

export const auth = createSupabaseAuth(supabase.auth, SITE_URL);

export const profileSource: ProfileSource = {
  async fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, time_zone, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};

export const sessionClient: SessionClient = {
  async load() {
    const { data, error } = await supabase.auth.getSession();
    return { userId: data.session?.user.id ?? null, offline: isAuthRetryableFetchError(error) };
  },
  onChange(listener) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) listener(session.user.id);
      if (event === 'SIGNED_OUT') listener(null);
    });
    return () => data.subscription.unsubscribe();
  },
};

/** The daily reminder (ADR-018). */
export const reminders = createSupabaseReminders(supabase);

/** The cloud side of sync (ADR-003, ADR-013). */
export const syncRemote = createSupabaseRemote(supabase);
