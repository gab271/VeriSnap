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

  /** Email a recovery code. */
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Exchange the emailed code for a session, then set the new password. */
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<{ error: string | null }>;
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

  /**
   * We use the emailed CODE rather than a magic link on purpose. A link has to
   * deep-link back into the app, which behaves differently in Expo Go, in a dev
   * build, and in the store build — three ways for a password reset to fail. A
   * six-digit code works identically everywhere and can be typed from any device.
   *
   * Requires the Supabase "Reset password" email template to include {{ .Token }}.
   */
  requestPasswordReset: async (email) => {
    set({ submitting: true });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    set({ submitting: false });
    return { error: error?.message ?? null };
  },

  confirmPasswordReset: async (email, code, newPassword) => {
    set({ submitting: true });

    // The code exchanges for a short-lived session; only then may we set a password.
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyError) {
      set({ submitting: false });
      return { error: verifyError.message };
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    set({ submitting: false });
    return { error: updateError?.message ?? null };
  },
}));
