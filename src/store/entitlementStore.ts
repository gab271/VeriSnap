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

  /** Refresh entitlement + usage from the server. */
  refresh: () => Promise<void>;
  setShowUpgradeModal: (visible: boolean) => void;
}

export const useEntitlementStore = create<EntitlementState>((set) => ({
  isPremium: false,
  monthlyCount: 0,
  limit: FREE_TIER_MONTHLY_LIMIT,
  loading: false,
  showUpgradeModal: false,

  refresh: async () => {
    set({ loading: true });
    // Fetch both in parallel; entitlement gates whether the counter even matters.
    const [{ isPremium }, monthlyCount] = await Promise.all([
      fetchEntitlement(),
      getMonthlyEvidenceCount(),
    ]);
    set({ isPremium, monthlyCount, loading: false });
  },

  setShowUpgradeModal: (visible) => set({ showUpgradeModal: visible }),
}));
