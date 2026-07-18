/**
 * The seal metaphor.
 *
 * A physical exhibit is sealed in a bag; the seal is either intact, not yet
 * applied, or broken. That maps exactly onto our three verification states and is
 * far more legible to a non-technical user than "hash_verified = false".
 */
import type { EvidenceRecord } from '@/types/evidence';

export type SealState = 'sealed' | 'awaiting' | 'broken';

export function sealStateOf(record: {
  hashVerified: boolean;
  signature: string | null;
  serverSha256Hash: string | null;
}): SealState {
  if (record.hashVerified && record.signature) return 'sealed';
  // The server hashed it and refused to sign — the bytes changed.
  if (!record.hashVerified && record.serverSha256Hash) return 'broken';
  return 'awaiting';
}

export const SEAL_COPY: Record<SealState, { label: string; glyph: string; note: string }> = {
  sealed: {
    label: 'Sealed',
    glyph: '◆',
    note: 'The server re-hashed the stored file and signed this record.',
  },
  awaiting: {
    label: 'Awaiting seal',
    glyph: '◇',
    note: 'Stored safely. It will be sealed automatically when the server verifies it.',
  },
  broken: {
    label: 'Seal broken',
    glyph: '✕',
    note: 'The stored file does not match the fingerprint taken at capture.',
  },
};

export function sealStateOfRecord(record: EvidenceRecord): SealState {
  return sealStateOf(record);
}
