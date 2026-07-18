/**
 * Client side of server-side verification.
 *
 * After a file is uploaded we ask the `verify-evidence` Edge Function to
 * independently re-hash the stored bytes and sign the record. The app never does
 * the verifying itself — that would be meaningless, since the whole point is that
 * an independent party confirms the hash. The client just triggers it and
 * displays the outcome.
 *
 * Verification is best-effort and idempotent: if it fails (offline, cold start,
 * transient error) the record simply stays `pending` and is retried later by
 * `verifyPendingRecords()` during the normal sync pass. Evidence is never lost —
 * it just isn't countersigned yet.
 */
import { supabase } from '@/services/supabase';
import type { VerificationResult } from '@/types/evidence';

/** Ask the server to verify + sign one record. */
export async function verifyEvidenceRecord(recordId: string): Promise<VerificationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-evidence', {
      body: { recordId },
    });

    if (error) {
      // Non-2xx responses arrive as errors; the body carries the real detail
      // (notably a 409 for a hash mismatch, which is a genuine finding).
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      let body: Record<string, unknown> | null = null;
      try {
        body = context?.json ? ((await context.json()) as Record<string, unknown>) : null;
      } catch {
        body = null;
      }

      if (body?.status === 'mismatch') {
        return {
          status: 'mismatch',
          serverHash: body.serverHash as string | undefined,
          message: 'Stored file does not match the hash recorded at capture.',
        };
      }
      return { status: 'pending', message: (body?.error as string) ?? error.message };
    }

    const result = data as Record<string, unknown> | null;
    if (result?.status === 'verified' || result?.status === 'already_verified') {
      return {
        status: 'verified',
        serverHash: result.serverHash as string | undefined,
        signature: result.signature as string | undefined,
        signingKeyId: result.signingKeyId as string | undefined,
        verifiedAt: result.verifiedAt as string | undefined,
      };
    }
    if (result?.status === 'mismatch') {
      return { status: 'mismatch', serverHash: result.serverHash as string | undefined };
    }
    return { status: 'pending' };
  } catch (error) {
    return { status: 'pending', message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sweep: verify any of the user's records that are still unsigned. Runs after the
 * offline queue drains, so captures made without signal get countersigned as soon
 * as connectivity returns. Bounded so a large backlog can't stall the app.
 */
export async function verifyPendingRecords(limit = 10): Promise<number> {
  const { data, error } = await supabase
    .from('evidence_records')
    .select('id')
    .eq('hash_verified', false)
    .is('signature', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data?.length) return 0;

  let verified = 0;
  for (const row of data) {
    const result = await verifyEvidenceRecord(row.id as string);
    if (result.status === 'verified') verified += 1;
  }
  return verified;
}
