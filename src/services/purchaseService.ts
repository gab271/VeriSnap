/**
 * PurchaseService — the monetization abstraction.
 *
 * Per our "Expo Go first" decision, RevenueCat's native SDK (`react-native-purchases`)
 * is NOT wired up yet, because it requires a custom development build and can't run
 * in Expo Go. This module is the seam where it will plug in:
 *
 *   - `fetchEntitlement()` today reads the `is_premium` flag from the `profiles`
 *     table (the server-side source of truth). In production, RevenueCat becomes
 *     the source and mirrors entitlements into that same column via a webhook, so
 *     the rest of the app keeps calling this function unchanged.
 *   - `purchaseTier()` is a stub. In a dev build it will present the RevenueCat
 *     paywall and complete the purchase.
 *
 * Keeping monetization behind this interface means the UI never talks to RevenueCat
 * directly, so swapping the stub for the real SDK later is a one-file change.
 */
import { supabase } from '@/services/supabase';

export type PremiumTier = 'premium' | 'pro';

export interface Entitlement {
  isPremium: boolean;
}

/** Reads the user's current entitlement from the server (RLS-scoped to them). */
export async function fetchEntitlement(): Promise<Entitlement> {
  const { data, error } = await supabase.from('profiles').select('is_premium').maybeSingle();
  if (error || !data) return { isPremium: false };
  return { isPremium: Boolean(data.is_premium) };
}

export interface PurchaseResult {
  ok: boolean;
  message: string;
}

/**
 * Stubbed purchase flow. Real in-app purchases require a development build with
 * RevenueCat configured (App Store / Play Store products + API keys).
 */
export async function purchaseTier(_tier: PremiumTier): Promise<PurchaseResult> {
  return {
    ok: false,
    message:
      'In-app purchases are enabled in the production build via RevenueCat. ' +
      'This preview runs in Expo Go, which cannot process real payments.',
  };
}
