-- =============================================================================
-- VeriSnap — initial schema, security policies, and free-tier enforcement
-- =============================================================================
-- Run this in the Supabase Dashboard -> SQL Editor (or via the Supabase CLI:
--   supabase db push).
--
-- SECURITY MODEL (read this before changing anything):
--   * Every table has Row Level Security (RLS) ENABLED. The app ships with the
--     public anon key, so RLS — not the key — is what protects the data.
--   * Evidence is treated as immutable: we deliberately define NO update/delete
--     policies. Under RLS, the absence of a policy means the action is denied
--     for all non-service-role clients. Being unable to alter a record after the
--     fact is the whole point of a chain-of-custody vault.
--   * Anything that must NOT be user-controllable (entitlements, the trusted
--     server timestamp, the monthly limit) is enforced server-side here, never
--     in the app.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: one row per user; holds the premium entitlement flag.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users may read their own profile (to know if they are premium) but may NOT
-- write it. `is_premium` is flipped only by trusted server code (e.g. a
-- RevenueCat webhook using the service_role key), never by the client.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-provision a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- evidence_records: the tamper-evident ledger.
-- -----------------------------------------------------------------------------
create table if not exists public.evidence_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,

  -- Location of the raw media in the private `evidence` Storage bucket.
  storage_path        text not null,

  -- Raw-byte SHA-256 (hex) computed ON-DEVICE before upload. This is the
  -- integrity anchor: the stored bytes can be re-hashed later and compared.
  sha256_hash         text not null,

  -- Device wall-clock time at capture (UTC). UNTRUSTED — the user can change
  -- their device clock — so it is informational only.
  captured_at_utc     timestamptz not null,

  -- TRUSTED timestamp written by Postgres, not the client. This is the time
  -- used for any legal / evidentiary purpose and for the free-tier window.
  server_received_at  timestamptz not null default now(),

  -- GPS fix captured at the moment of the shutter press.
  gps_lat             double precision,
  gps_lng             double precision,
  gps_accuracy_m      double precision,
  location_captured_at timestamptz,

  device_info         jsonb,
  exif                jsonb,
  category            text check (category in ('traffic', 'rental', 'incident')),

  created_at          timestamptz not null default now()
);

create index if not exists evidence_records_user_created_idx
  on public.evidence_records (user_id, created_at desc);

alter table public.evidence_records enable row level security;

drop policy if exists "Users can read own evidence" on public.evidence_records;
create policy "Users can read own evidence"
  on public.evidence_records for select
  using (auth.uid() = user_id);

-- A client may only insert rows attributed to itself. Combined with the trigger
-- below, this is the complete write surface — no UPDATE/DELETE policies exist,
-- so records are append-only and immutable to clients.
drop policy if exists "Users can insert own evidence" on public.evidence_records;
create policy "Users can insert own evidence"
  on public.evidence_records for insert
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Free-tier monthly limit — enforced server-side so it cannot be bypassed by
-- tampering with the app. Free users: 3 records per calendar month. Premium:
-- unlimited.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_free_tier_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  monthly_count integer;
  premium       boolean;
begin
  select is_premium into premium from public.profiles where id = new.user_id;

  if coalesce(premium, false) then
    return new; -- premium users are unlimited
  end if;

  select count(*) into monthly_count
  from public.evidence_records
  where user_id = new.user_id
    and created_at >= date_trunc('month', now());

  if monthly_count >= 3 then
    raise exception 'FREE_TIER_LIMIT_REACHED'
      using hint = 'Upgrade to Premium to capture more than 3 pieces of evidence per month.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_tier_before_insert on public.evidence_records;
create trigger enforce_free_tier_before_insert
  before insert on public.evidence_records
  for each row execute function public.enforce_free_tier_limit();

-- Convenience RPC for the client to display remaining captures. It only ever
-- reports the caller's own usage (auth.uid()), so it leaks nothing.
create or replace function public.current_month_evidence_count()
returns integer
language sql
security definer set search_path = public
as $$
  select count(*)::integer
  from public.evidence_records
  where user_id = auth.uid()
    and created_at >= date_trunc('month', now());
$$;

-- -----------------------------------------------------------------------------
-- Storage: private `evidence` bucket + per-user folder isolation.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- Media is stored under a folder named after the owner's uid: `<uid>/<file>`.
-- These policies ensure a user can only ever touch their own folder. As with
-- the table, no update/delete policies exist -> uploaded media is immutable.
drop policy if exists "Users can upload own evidence media" on storage.objects;
create policy "Users can upload own evidence media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read own evidence media" on storage.objects;
create policy "Users can read own evidence media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
