/**
 * Monetization — RevenueCat, behind the seam that has always been here.
 *
 * WHY THE NATIVE SDK IS LOADED LAZILY:
 * `react-native-purchases` is a native module. It exists in a development/production
 * build but NOT in Expo Go. Rather than force everyone onto a custom build, we load
 * it on first use inside a try/catch: if it isn't there, billing is simply reported
 * as unavailable and the app keeps running with server-side entitlements. That
 * means the same codebase runs in Expo Go for day-to-day work and does real
 * purchases in a dev build, with no branching at the call sites.
 *
 * WHAT ACTUALLY GATES ACCESS:
 * Not this file. The free-tier limit is enforced by a Postgres trigger using
 * `profiles.is_premium`, which is written server-side by the RevenueCat webhook.
 * The client's view of entitlement is only ever used to render UI — a tampered
 * client can claim to be premium and still be refused by the database.
 */
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase';

/** Entitlement identifier configured in the RevenueCat dashboard. */
const ENTITLEMENT_ID = 'premium';

/** RevenueCat package identifiers, per tier. Must match the dashboard. */
const PACKAGE_BY_TIER: Record<PremiumTier, string> = {
  premium: 'premium_monthly',
  pro: 'pro_monthly',
};

export type PremiumTier = 'premium' | 'pro';

export interface Entitlement {
  isPremium: boolean;
  /** True when the native billing SDK is present and configured. */
  billingAvailable: boolean;
}

export interface PurchaseResult {
  ok: boolean;
  message: string;
  /** True when the user simply backed out — not an error worth alarming about. */
  cancelled?: boolean;
}

// --- Lazy native module ------------------------------------------------------

type PurchasesModule = typeof import('react-native-purchases').default;

let cachedModule: PurchasesModule | null | undefined;
let configured = false;

function loadPurchases(): PurchasesModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // Resolved at runtime so Expo Go, which has no native billing, degrades
    // instead of crashing at import time.
    const mod = require('react-native-purchases');
    cachedModule = (mod?.default ?? mod) as PurchasesModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

function apiKey(): string | undefined {
  return Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
}

/**
 * Configure billing for a signed-in user. Safe to call repeatedly and safe to
 * call in Expo Go — it no-ops when the SDK or key is absent.
 *
 * The RevenueCat app user id is set to the Supabase user id so the webhook can
 * map an entitlement back to the right row without any extra bookkeeping.
 */
export async function configureBilling(userId: string): Promise<boolean> {
  if (configured) return true;

  const Purchases = loadPurchases();
  const key = apiKey();
  if (!Purchases || !key) return false;

  try {
    await Purchases.configure({ apiKey: key, appUserID: userId });
    configured = true;
    return true;
  } catch (error) {
    console.warn('[VeriSnap] RevenueCat configure failed', error);
    return false;
  }
}

export function isBillingAvailable(): boolean {
  return configured;
}

// --- Entitlement -------------------------------------------------------------

/**
 * The server's view of the user's plan. Read from `profiles`, which the webhook
 * keeps in sync — this is the same value the database trigger enforces with, so
 * the UI can never disagree with what the backend will actually allow.
 */
export async function fetchEntitlement(): Promise<Entitlement> {
  const billingAvailable = configured;

  const { data, error } = await supabase
    .from('profiles')
    .select('is_premium, premium_expires_at')
    .maybeSingle();

  if (error || !data) return { isPremium: false, billingAvailable };

  const expiresAt = data.premium_expires_at ? new Date(data.premium_expires_at as string) : null;
  const expired = expiresAt !== null && expiresAt.getTime() < Date.now();

  return { isPremium: Boolean(data.is_premium) && !expired, billingAvailable };
}

function hasActiveEntitlement(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

// --- Purchase ----------------------------------------------------------------

async function findPackage(
  Purchases: PurchasesModule,
  tier: PremiumTier,
): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;

  const wanted = PACKAGE_BY_TIER[tier];
  return (
    current.availablePackages.find((pkg) => pkg.identifier === wanted) ??
    current.availablePackages.find((pkg) => pkg.product.identifier === wanted) ??
    null
  );
}

export async function purchaseTier(tier: PremiumTier): Promise<PurchaseResult> {
  const Purchases = loadPurchases();

  if (!Purchases || !configured) {
    return {
      ok: false,
      message:
        'In-app purchases need the full VeriSnap build. This preview runs in Expo Go, which ' +
        'cannot process payments.',
    };
  }

  try {
    const pkg = await findPackage(Purchases, tier);
    if (!pkg) {
      return { ok: false, message: 'That plan is not available right now.' };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (hasActiveEntitlement(customerInfo)) {
      return {
        ok: true,
        message: 'Purchase complete. Your plan activates in a moment.',
      };
    }
    return { ok: false, message: 'The purchase completed but no plan was activated.' };
  } catch (error) {
    const err = error as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) {
      return { ok: false, cancelled: true, message: '' };
    }
    return { ok: false, message: err?.message ?? 'The purchase could not be completed.' };
  }
}

/**
 * Restoring purchases is required by the App Store when an app sells anything:
 * someone who reinstalls, or signs in on a second device, must be able to get
 * back what they already paid for without paying again.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  const Purchases = loadPurchases();

  if (!Purchases || !configured) {
    return { ok: false, message: 'Restoring purchases needs the full VeriSnap build.' };
  }

  try {
    const info = await Purchases.restorePurchases();
    return hasActiveEntitlement(info)
      ? { ok: true, message: 'Purchases restored. Your plan activates in a moment.' }
      : { ok: false, message: 'No previous purchases were found for this account.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not restore purchases.',
    };
  }
}
