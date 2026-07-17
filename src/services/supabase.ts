/**
 * Supabase client — the single, securely-configured entry point to the backend.
 *
 * SECURITY DECISIONS (why this file looks the way it does):
 *
 * 1. Only the ANON (public) key is used here. The anon key is meant to be
 *    embedded in client apps; it is NOT a secret. Real protection comes from
 *    Row Level Security (RLS) policies on every table (see
 *    supabase/migrations/0001_init.sql). The `service_role` key — which bypasses
 *    RLS — must never appear anywhere in this app.
 *
 * 2. Session tokens are persisted with AsyncStorage so a user stays signed in.
 *    The identity in the JWT is what stamps `user_id` onto every piece of
 *    evidence, so a stable, verifiable session is part of the chain of custody.
 *
 * 3. `detectSessionInUrl: false` — that browser-only feature is irrelevant (and
 *    unsafe to leave on) in a native app.
 *
 * 4. `react-native-url-polyfill/auto` is imported first because supabase-js relies
 *    on the WHATWG URL API, which React Native does not provide natively.
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Fail loudly during development if the environment is not configured. We do not
// throw so the app can still boot to a readable error state, but we surface the
// problem clearly.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[VeriSnap] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and add your Supabase project values.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * Supabase recommends pausing token auto-refresh while the app is backgrounded
 * and resuming it when the app is foregrounded. This keeps the access token
 * fresh whenever the user is actively capturing evidence.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
