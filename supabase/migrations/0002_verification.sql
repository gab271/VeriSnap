-- =============================================================================
-- VeriSnap — server-side hash verification + cryptographic signing
-- =============================================================================
-- Run AFTER 0001_init.sql (Dashboard -> SQL Editor, or `supabase db push`).
--
-- WHY THIS EXISTS:
-- Until now the SHA-256 stored on a record was supplied by the client and never
-- checked against the bytes actually sitting in storage. A tampered client could
-- have sent any hash it liked, which would undermine the whole product: the hash
-- only proves something if an independent party computed it.
--
-- The `verify-evidence` Edge Function now downloads the stored object with the
-- service_role key, RE-HASHES it server-side, compares it to the client's hash,
-- and — only if they match — SIGNS the record with a private key that never
-- leaves the server. The signature is what makes a record provably un-forged and
-- attributable; anyone holding the public key can verify it offline, forever.
-- =============================================================================

alter table public.evidence_records
  -- SHA-256 the SERVER computed from the stored bytes (the trustworthy one).
  add column if not exists server_sha256_hash text,
  -- True only when server_sha256_hash === the client-supplied sha256_hash.
  add column if not exists hash_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  -- Base64 ECDSA P-256 signature (IEEE P1363 r||s) over `signed_payload`.
  add column if not exists signature text,
  -- Which key signed this, so keys can be rotated without invalidating history.
  add column if not exists signing_key_id text,
  -- The EXACT canonical string that was signed. Stored verbatim so a third party
  -- never has to guess how to reconstruct it — they verify the signature over
  -- this string and check its fields match the record.
  add column if not exists signed_payload text;

-- Find records still awaiting verification (used to retry after a failure).
create index if not exists evidence_records_unverified_idx
  on public.evidence_records (user_id)
  where hash_verified = false;

-- -----------------------------------------------------------------------------
-- CRITICAL GUARD: clients must never be able to declare their own evidence
-- "verified". The INSERT policy from 0001 lets a user insert a row for
-- themselves — which would otherwise let them set hash_verified = true and forge
-- a signature column. This BEFORE INSERT trigger forcibly blanks every
-- verification field on the way in, no matter what the client sends.
--
-- The Edge Function is unaffected: it only ever UPDATEs (with the service_role
-- key), and this trigger fires on INSERT.
-- -----------------------------------------------------------------------------
create or replace function public.force_unverified_on_insert()
returns trigger
language plpgsql
as $$
begin
  new.server_sha256_hash := null;
  new.hash_verified      := false;
  new.verified_at        := null;
  new.signature          := null;
  new.signing_key_id     := null;
  new.signed_payload     := null;
  return new;
end;
$$;

drop trigger if exists force_unverified_before_insert on public.evidence_records;
create trigger force_unverified_before_insert
  before insert on public.evidence_records
  for each row execute function public.force_unverified_on_insert();

-- Note: there is still NO update/delete policy on evidence_records, so clients
-- cannot modify these columns after the fact either. Only the service_role key
-- (used exclusively by the Edge Function) can write them.
