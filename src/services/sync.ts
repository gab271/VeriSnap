/**
 * Background sync — drains the offline queue whenever we have connectivity.
 *
 * Retries are idempotent (see offlineQueue.ts / uploadEvidence.ts): an item that
 * already has its DB row only gets its file re-uploaded, and duplicate uploads
 * are treated as success. A `syncing` guard prevents overlapping flushes if
 * several connectivity events fire in quick succession.
 */
import NetInfo from '@react-native-community/netinfo';

import {
  listPending,
  markRowInserted,
  recordAttempt,
  removePending,
} from '@/services/offlineQueue';
import { insertEvidenceRow, uploadEvidenceFile } from '@/services/uploadEvidence';
import { verifyPendingRecords } from '@/services/verification';

let syncing = false;

/** Attempt to upload every queued item. `onChange` fires after each success. */
export async function flushQueue(onChange?: () => void): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await listPending();
    for (const item of pending) {
      try {
        // Insert the row first if it isn't there yet.
        if (!item.rowInserted) {
          const { limitReached } = await insertEvidenceRow(item.insert);
          if (limitReached) {
            // Over the free limit — retrying won't help until the user upgrades.
            // Leave it queued and move on rather than spinning on it.
            await recordAttempt(item.id, 'FREE_TIER_LIMIT_REACHED');
            continue;
          }
          await markRowInserted(item.id);
        }

        await uploadEvidenceFile(item.insert.storage_path, item.localUri, item.contentType);
        await removePending(item.id);
        onChange?.();
      } catch (error) {
        // Transient (likely network) failure — record it and stop this pass; the
        // next connectivity event will trigger another flush.
        await recordAttempt(item.id, error instanceof Error ? error.message : String(error));
        break;
      }
    }

    // Countersign anything still unsigned — captures made offline get verified as
    // soon as connectivity returns. Best-effort; failures are retried next pass.
    await verifyPendingRecords();
  } finally {
    syncing = false;
  }
}

/**
 * Start auto-sync: flush once now, then again every time connectivity is
 * (re)gained. Returns an unsubscribe function.
 */
export function startAutoSync(onChange?: () => void): () => void {
  void flushQueue(onChange);

  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void flushQueue(onChange);
    }
  });
}
