/**
 * Authentication state (Zustand).
 *
 * The signed-in user's id is what binds every evidence record to a real,
 * verifiable identity, so auth is foundational to the chain of custody rather
 * than just a login gate. We use Supabase email/password auth.
 */
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/services/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  /** True until we have resolved the persisted session on cold start. */
  initializing: boolean;
  /** True while a sign-in / sign-up request is in flight. */
  submitting: boolean;

  /** Resolve the persisted session and subscribe to future auth changes. */
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  initializing: true,
  submitting: false,

  initialize: () => {
    // Load whatever session AsyncStorage already has (keeps users signed in).
    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        initializing: false,
      });
    });

    // Keep local state in lock-step with Supabase (token refresh, sign-out, etc.).
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, initializing: false });
    });

    // Returned so the caller can unsubscribe on unmount.
    return () => subscription.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    set({ submitting: true });
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    set({ submitting: false });
    return { error: error?.message ?? null };
  },

  signUp: async (email, password) => {
    set({ submitting: true });
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    set({ submitting: false });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
