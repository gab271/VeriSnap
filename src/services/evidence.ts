/**
 * Evidence assembly — turns a raw capture into the signed-off metadata payload.
 *
 * This binds together everything that constitutes the chain of custody for one
 * capture: the on-device SHA-256 of the file, the shutter-time UTC timestamp, the
 * independently-read GPS fix, the device fingerprint, and the raw EXIF. The result
 * is the exact object that will be uploaded and inserted into `evidence_records`
 * in Milestone 4 (with the offline queue as a fallback).
 */
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';

import { getDeviceInfo } from '@/services/deviceInfo';
import { hashFileSha256 } from '@/services/hashing';
import { enqueueEvidence } from '@/services/offlineQueue';
import { supabase } from '@/services/supabase';
import { insertEvidenceRow, uploadEvidenceFile } from '@/services/uploadEvidence';
import type {
  CaptureResult,
  EvidenceCategory,
  EvidenceInsert,
  EvidenceMetadata,
  SaveResult,
} from '@/types/evidence';

const CONTENT_TYPE = 'image/jpeg';

interface BuildEvidenceArgs {
  capture: CaptureResult;
  userId: string;
  category?: EvidenceCategory | null;
}

export async function buildEvidenceMetadata({
  capture,
  userId,
  category = null,
}: BuildEvidenceArgs): Promise<EvidenceMetadata> {
  // Hash first: if we can't fingerprint the file we must not proceed, because a
  // record without a verifiable hash has no evidentiary value.
  const sha256Hash = await hashFileSha256(capture.uri);

  return {
    userId,
    utcTimestamp: capture.utcTimestamp,
    gpsCoordinates: capture.gps,
    deviceInfo: getDeviceInfo(),
    sha256Hash,
    exif: capture.exif,
    category,
  };
}

/**
 * How many evidence records the current user has created this calendar month.
 * Uses the SECURITY DEFINER RPC, which only ever counts the caller's own rows —
 * this drives the "X of 3 used" indicator and the upgrade prompt. Returns 0 on
 * error so the UI degrades gracefully (the server trigger is the real gate).
 */
export async function getMonthlyEvidenceCount(): Promise<number> {
  const { data, error } = await supabase.rpc('current_month_evidence_count');
  if (error || data == null) return 0;
  return Number(data);
}

/** Map assembled metadata to the exact row we insert into `evidence_records`. */
function toInsert(metadata: EvidenceMetadata, id: string, storagePath: string): EvidenceInsert {
  return {
    id,
    user_id: metadata.userId,
    storage_path: storagePath,
    sha256_hash: metadata.sha256Hash,
    captured_at_utc: metadata.utcTimestamp,
    gps_lat: metadata.gpsCoordinates?.latitude ?? null,
    gps_lng: metadata.gpsCoordinates?.longitude ?? null,
    gps_accuracy_m: metadata.gpsCoordinates?.accuracy ?? null,
    location_captured_at: metadata.gpsCoordinates?.capturedAt ?? null,
    device_info: metadata.deviceInfo,
    exif: metadata.exif,
    category: metadata.category,
  };
}

/**
 * Persist a capture end-to-end. This is the single entry point the UI calls.
 *
 * ORDERING RATIONALE (insert row, THEN upload file):
 *  - Inserting first lets the server-side free-tier trigger reject over-limit
 *    captures BEFORE we waste bandwidth uploading a file we couldn't keep.
 *  - It also avoids orphaned storage objects: since evidence is immutable (no
 *    DELETE policy), we can never clean up a file whose row was rejected. Not
 *    uploading until the row exists sidesteps that entirely.
 *  - If the network drops between insert and upload, we queue an upload-only
 *    retry (rowInserted: true) so the record is never duplicated.
 */
export async function saveEvidence({
  capture,
  userId,
  category = null,
}: BuildEvidenceArgs): Promise<SaveResult> {
  let metadata: EvidenceMetadata;
  try {
    // Always hash on-device first — a record without a verifiable hash is worthless.
    metadata = await buildEvidenceMetadata({ capture, userId, category });
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }

  const id = Crypto.randomUUID();
  const storagePath = `${userId}/${id}.jpg`;
  const insert = toInsert(metadata, id, storagePath);
  const { sha256Hash } = metadata;

  // If we already know we're offline, don't even attempt the network — queue it.
  const net = await NetInfo.fetch();
  const online = net.isConnected !== false && net.isInternetReachable !== false;
  if (!online) {
    await enqueueEvidence({ insert, sourceUri: capture.uri, contentType: CONTENT_TYPE, rowInserted: false });
    return { status: 'queued', reason: 'offline', sha256Hash };
  }

  // Step 1: insert the row (enforces the limit, reserves the record).
  try {
    const { limitReached } = await insertEvidenceRow(insert);
    if (limitReached) return { status: 'limit_reached' };
  } catch {
    // Likely a transient network error — hold the whole item for retry.
    await enqueueEvidence({ insert, sourceUri: capture.uri, contentType: CONTENT_TYPE, rowInserted: false });
    return { status: 'queued', reason: 'error', sha256Hash };
  }

  // Step 2: upload the file. The row exists now, so a failure only needs the
  // upload retried — enqueue with rowInserted: true to avoid a duplicate insert.
  try {
    await uploadEvidenceFile(storagePath, capture.uri, CONTENT_TYPE);
    return { status: 'uploaded', sha256Hash };
  } catch {
    await enqueueEvidence({ insert, sourceUri: capture.uri, contentType: CONTENT_TYPE, rowInserted: true });
    return { status: 'queued', reason: 'error', sha256Hash };
  }
}
