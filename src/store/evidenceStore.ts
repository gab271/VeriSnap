/**
 * Evidence sync state (Zustand): how many captures are waiting to upload, and the
 * lifecycle for the background sync loop. The capture screen reads `pendingCount`
 * to show an "N pending upload" indicator so the user always knows nothing was
 * lost while they were offline.
 */
import { create } from 'zustand';

import { countPending } from '@/services/offlineQueue';
import { startAutoSync } from '@/services/sync';

interface EvidenceState {
  pendingCount: number;
  /** Recompute the pending count from the local queue. */
  refreshPending: () => Promise<void>;
  /** Begin auto-sync (flush now + on every reconnect). Returns an unsubscribe. */
  startSync: () => () => void;
}

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  pendingCount: 0,

  refreshPending: async () => {
    set({ pendingCount: await countPending() });
  },

  startSync: () => {
    const unsubscribe = startAutoSync(() => {
      // Refresh the badge each time an item finishes uploading.
      void get().refreshPending();
    });
    void get().refreshPending();
    return unsubscribe;
  },
}));
