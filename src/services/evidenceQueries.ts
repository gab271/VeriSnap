/**
 * Reading evidence back out of the vault.
 *
 * Every query here is implicitly scoped to the signed-in user by RLS — there is
 * no user filter in the code because the database enforces it. The evidence
 * bucket is private, so images are fetched through short-lived signed URLs rather
 * than public links; the list batches them into a single request.
 */
import { supabase } from '@/services/supabase';
import type { EvidenceRecord } from '@/types/evidence';
import { EVIDENCE_BUCKET } from '@/utils/constants';

/** Signed URLs are short-lived on purpose: a leaked link expires quickly. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type EvidenceRow = Record<string, unknown>;

function mapRow(row: EvidenceRow): EvidenceRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    storagePath: row.storage_path as string,
    sha256Hash: row.sha256_hash as string,
    capturedAtUtc: row.captured_at_utc as string,
    serverReceivedAt: row.server_received_at as string,
    gpsLat: (row.gps_lat as number | null) ?? null,
    gpsLng: (row.gps_lng as number | null) ?? null,
    gpsAccuracyM: (row.gps_accuracy_m as number | null) ?? null,
    locationCapturedAt: (row.location_captured_at as string | null) ?? null,
    deviceInfo: (row.device_info as EvidenceRecord['deviceInfo']) ?? null,
    exif: (row.exif as Record<string, unknown> | null) ?? null,
    category: (row.category as EvidenceRecord['category']) ?? null,
    createdAt: row.created_at as string,
    serverSha256Hash: (row.server_sha256_hash as string | null) ?? null,
    hashVerified: Boolean(row.hash_verified),
    verifiedAt: (row.verified_at as string | null) ?? null,
    signature: (row.signature as string | null) ?? null,
    signingKeyId: (row.signing_key_id as string | null) ?? null,
    signedPayload: (row.signed_payload as string | null) ?? null,
  };
}

/** Most recent first — the log reads newest at the top. */
export async function listEvidence(limit = 100): Promise<EvidenceRecord[]> {
  const { data, error } = await supabase
    .from('evidence_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getEvidenceById(id: string): Promise<EvidenceRecord | null> {
  const { data, error } = await supabase
    .from('evidence_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * One signed URL. Returns null rather than throwing: a missing image should
 * degrade to a placeholder, never blank the whole record.
 */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Batched signed URLs for the log, keyed by storage path. */
export async function getSignedUrls(storagePaths: string[]): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return {};

  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}
