-- =============================================================================
-- VeriSnap — subscription entitlements
-- =============================================================================
-- Run AFTER 0002_verification.sql.
--
-- Subscriptions expire, so `is_premium` alone is not enough: a cancelled plan
-- must stop granting unlimited captures the moment it lapses. These columns are
-- written ONLY by the RevenueCat webhook (service_role); clients can read their
-- own row but never write it, so a user cannot grant themselves a plan.
-- =============================================================================

alter table public.profiles
  -- When the current subscription period ends. NULL = no active subscription.
  add column if not exists premium_expires_at timestamptz,
  -- RevenueCat's app user id, for support and reconciliation.
  add column if not exists revenuecat_user_id text,
  -- Which plan is active, for display and analytics.
  add column if not exists plan text check (plan in ('free', 'premium', 'pro'));

-- -----------------------------------------------------------------------------
-- The free-tier trigger from 0001 checks `is_premium`. Teach it about expiry so
-- a lapsed subscription falls back to the free limit automatically, without
-- anyone having to run a cleanup job.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_free_tier_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  monthly_count integer;
  premium       boolean;
  expires_at    timestamptz;
begin
  select is_premium, premium_expires_at
    into premium, expires_at
    from public.profiles
   where id = new.user_id;

  -- Premium only counts while it has not lapsed. A null expiry means a plan
  -- with no end date (e.g. granted manually), which stays active.
  if coalesce(premium, false) and (expires_at is null or expires_at > now()) then
    return new;
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
