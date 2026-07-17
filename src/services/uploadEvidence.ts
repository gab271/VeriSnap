/**
 * Low-level Supabase writes: upload the media, insert the record. Both are used
 * by the online path (evidence.ts) and by the retry path (sync.ts), so they are
 * written to be idempotent and safe to call more than once for the same capture.
 */
import { File } from 'expo-file-system';

import { supabase } from '@/services/supabase';
import type { EvidenceInsert } from '@/types/evidence';
import { EVIDENCE_BUCKET } from '@/utils/constants';

const FREE_TIER_ERROR = 'FREE_TIER_LIMIT_REACHED';

/**
 * Uploads the raw file bytes to the private evidence bucket. Reads the bytes with
 * File.arrayBuffer() (the same raw bytes we hashed) rather than a base64 detour.
 * A duplicate-object error is treated as success so a retry after a partial
 * failure is safe.
 */
export async function uploadEvidenceFile(
  storagePath: string,
  localUri: string,
  contentType: string,
): Promise<void> {
  const buffer = await new File(localUri).arrayBuffer();

  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (error) {
    // The object already exists from a previous attempt — idempotent success.
    if (/exists|duplicate|409/i.test(error.message)) return;
    throw error;
  }
}

/**
 * Inserts the metadata row. The server-side trigger enforces the free-tier limit;
 * we surface that specific case as `limitReached` (a business rule, not a failure)
 * so the caller can prompt an upgrade instead of retrying.
 */
export async function insertEvidenceRow(
  insert: EvidenceInsert,
): Promise<{ limitReached: boolean }> {
  const { error } = await supabase.from('evidence_records').insert(insert);

  if (error) {
    if (error.message.includes(FREE_TIER_ERROR)) {
      return { limitReached: true };
    }
    throw error;
  }
  return { limitReached: false };
}
