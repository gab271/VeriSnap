/**
 * verify-evidence — server-side hash re-verification + cryptographic signing.
 *
 * THIS IS WHAT MAKES THE EVIDENCE REAL.
 *
 * Before this function existed, the SHA-256 on a record was whatever the client
 * said it was. Now the server independently downloads the stored object with the
 * service_role key, re-hashes the actual bytes, and compares. Only on a match
 * does it sign the record with a private key that never leaves the server.
 *
 * The result is a record that a court, insurer, or opposing lawyer can verify
 * offline and forever, using only the public key:
 *   1. re-hash the file          -> must equal server_sha256_hash
 *   2. read signed_payload       -> must contain that hash and match the record
 *   3. verify signature          -> proves VeriSnap's server attested to it
 *
 * A hash MISMATCH is never silently ignored: the record is flagged
 * hash_verified = false with the server's hash recorded, which is itself
 * evidence that something was tampered with.
 *
 * Deploy:
 *   npx supabase functions deploy verify-evidence
 * Required secrets:
 *   EVIDENCE_SIGNING_PRIVATE_KEY  (base64 PKCS8, ECDSA P-256)
 *   EVIDENCE_SIGNING_KEY_ID       (e.g. vs-2026-07-18-a1b2c3d4)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KEY_IMPORT_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' } as const;
const BUCKET = 'evidence';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Timestamps are normalised to millisecond ISO-8601 UTC so verifiers can reproduce them. */
function canonicalTimestamp(value: string): string {
  return new Date(value).toISOString();
}

/**
 * The EXACT string that gets signed. Deterministic and line-oriented so it can be
 * reproduced byte-for-byte by any verifier. Stored verbatim on the record as
 * `signed_payload`, so nobody has to guess the format.
 */
function buildSignedPayload(record: Record<string, unknown>, serverHash: string): string {
  const lat = record.gps_lat as number | null;
  const lng = record.gps_lng as number | null;
  const gps = lat != null && lng != null ? `${lat},${lng}` : 'none';

  return [
    'VeriSnap-v1',
    `id=${record.id}`,
    `user_id=${record.user_id}`,
    `sha256=${serverHash}`,
    `captured_at_utc=${canonicalTimestamp(record.captured_at_utc as string)}`,
    `server_received_at=${canonicalTimestamp(record.server_received_at as string)}`,
    `storage_path=${record.storage_path}`,
    `gps=${gps}`,
  ].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // Supabase is migrating from anon/service_role keys to publishable/secret keys.
  // Accept either naming so this works on both old and new projects.
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  const anonKey =
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const privateKeyB64 = Deno.env.get('EVIDENCE_SIGNING_PRIVATE_KEY');
  const signingKeyId = Deno.env.get('EVIDENCE_SIGNING_KEY_ID') ?? 'unknown';

  if (!supabaseUrl || !serviceKey || !anonKey) {
    // Name exactly what's missing — a silent 500 here is painful to debug.
    const missing = [
      !supabaseUrl && 'SUPABASE_URL',
      !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)',
      !anonKey && 'SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)',
    ].filter(Boolean);
    return json({ error: `Supabase environment not configured. Missing: ${missing.join(', ')}` }, 500);
  }
  if (!privateKeyB64) {
    return json({ error: 'EVIDENCE_SIGNING_PRIVATE_KEY is not set' }, 500);
  }

  // 1. Identify the caller from their JWT (never trust a user id from the body).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  const callerId = userData.user.id;

  let recordId: string | undefined;
  try {
    const body = await req.json();
    recordId = body?.recordId;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!recordId) return json({ error: 'recordId is required' }, 400);

  // service_role client: bypasses RLS so it can read storage and write the
  // verification columns that no client is permitted to touch.
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: record, error: recordError } = await admin
    .from('evidence_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (recordError || !record) return json({ error: 'Record not found' }, 404);

  // 2. Authorization: you may only verify your OWN evidence.
  if (record.user_id !== callerId) return json({ error: 'Forbidden' }, 403);

  // 3. Idempotent: already verified records are returned as-is.
  if (record.hash_verified && record.signature) {
    return json({
      status: 'already_verified',
      hashVerified: true,
      serverHash: record.server_sha256_hash,
      signature: record.signature,
      signingKeyId: record.signing_key_id,
      verifiedAt: record.verified_at,
    });
  }

  // 4. Download the ACTUAL stored bytes and re-hash them.
  const { data: blob, error: downloadError } = await admin.storage
    .from(BUCKET)
    .download(record.storage_path);

  if (downloadError || !blob) {
    return json({ error: 'Stored object not found — has the upload finished?' }, 404);
  }

  const fileBytes = new Uint8Array(await blob.arrayBuffer());
  const serverHash = bytesToHex(await crypto.subtle.digest('SHA-256', fileBytes));

  // 5. Mismatch = tampering or corruption. Record it, refuse to sign.
  if (serverHash !== record.sha256_hash) {
    await admin
      .from('evidence_records')
      .update({
        server_sha256_hash: serverHash,
        hash_verified: false,
        verified_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    return json(
      {
        status: 'mismatch',
        hashVerified: false,
        clientHash: record.sha256_hash,
        serverHash,
        error: 'Stored bytes do not match the hash recorded at capture time.',
      },
      409,
    );
  }

  // 6. Match — sign the canonical payload.
  let signature: string;
  let signedPayload: string;
  try {
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      base64ToBytes(privateKeyB64),
      KEY_IMPORT_ALGORITHM,
      false,
      ['sign'],
    );
    signedPayload = buildSignedPayload(record, serverHash);
    const signatureBuffer = await crypto.subtle.sign(
      SIGN_ALGORITHM,
      privateKey,
      new TextEncoder().encode(signedPayload),
    );
    signature = bytesToBase64(new Uint8Array(signatureBuffer));
  } catch (error) {
    return json(
      { error: `Signing failed: ${error instanceof Error ? error.message : String(error)}` },
      500,
    );
  }

  const verifiedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from('evidence_records')
    .update({
      server_sha256_hash: serverHash,
      hash_verified: true,
      verified_at: verifiedAt,
      signature,
      signing_key_id: signingKeyId,
      signed_payload: signedPayload,
    })
    .eq('id', record.id);

  if (updateError) return json({ error: updateError.message }, 500);

  return json({
    status: 'verified',
    hashVerified: true,
    serverHash,
    signature,
    signingKeyId,
    verifiedAt,
  });
});
