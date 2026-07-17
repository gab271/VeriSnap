/**
 * App-wide constants.
 *
 * NOTE ON THE FREE-TIER LIMIT: this value is mirrored on the client purely for
 * UX (to show the upgrade modal at the right time). The *authoritative* limit is
 * enforced server-side in Postgres (see supabase/migrations/0001_init.sql), so a
 * user cannot bypass it by tampering with the app.
 */
export const FREE_TIER_MONTHLY_LIMIT = 3;

/** Name of the private Supabase Storage bucket that holds evidence media. */
export const EVIDENCE_BUCKET = 'evidence';

/** The kinds of incident VeriSnap is designed to document. */
export const EVIDENCE_CATEGORIES = ['traffic', 'rental', 'incident'] as const;
