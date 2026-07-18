/**
 * Freemium state (Zustand): the user's premium entitlement, their usage this
 * month, and whether the upgrade modal is showing.
 *
 * IMPORTANT: this state is for UX only — showing the counter and the paywall at
 * the right moment. The actual 3-per-month limit is enforced server-side by a
 * Postgres trigger (see supabase/migrations/0001_init.sql), so nothing here can
 * be tampered with to bypass it.
 */
import { create } from 'zustand';

import { getMonthlyEvidenceCount } from '@/services/evidence';
import { fetchEntitlement } from '@/services/purchaseService';
import { FREE_TIER_MONTHLY_LIMIT } from '@/utils/constants';

interface EntitlementState {
  isPremium: boolean;
  monthlyCount: number;
  limit: number;
  loading: boolean;
  showUpgradeModal: boolean;
  /** True when the native billing SDK is present (a dev/production build). */
  billingAvailable: boolean;

  /** Refresh entitlement + usage from the server. */
  refresh: () => Promise<void>;
  /** Re-read entitlement a few times while a purchase webhook lands. */
  refreshAfterPurchase: () => Promise<void>;
  setShowUpgradeModal: (visible: boolean) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  isPremium: false,
  monthlyCount: 0,
  limit: FREE_TIER_MONTHLY_LIMIT,
  loading: false,
  showUpgradeModal: false,
  billingAvailable: false,

  refresh: async () => {
    set({ loading: true });
    // Fetch both in parallel; entitlement gates whether the counter even matters.
    const [{ isPremium, billingAvailable }, monthlyCount] = await Promise.all([
      fetchEntitlement(),
      getMonthlyEvidenceCount(),
    ]);
    set({ isPremium, billingAvailable, monthlyCount, loading: false });
  },

  /**
   * A purchase is confirmed on the device before RevenueCat's webhook has told
   * our database about it, so a single refresh usually still reports "free".
   * Poll briefly rather than making the user wonder what they paid for.
   */
  refreshAfterPurchase: async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await get().refresh();
      if (get().isPremium) return;
      await sleep(1500);
    }
  },

  setShowUpgradeModal: (visible) => set({ showUpgradeModal: visible }),
}));
