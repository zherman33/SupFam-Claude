-- =============================================================
-- Sup Fam multi-tenant billing foundation
-- - Billing columns on families (Stripe-native subscription state)
-- - subscription_events idempotency log for the Stripe webhook
-- - Backfill: the one existing family is a grandfathered founding family
-- - SECURITY FIX: families could be enumerated by any authenticated user
--   via the invite-code lookup policy (names + invite codes leaked).
--   Join-by-code now goes through a SECURITY DEFINER RPC.
-- - SECURITY FIX: waitlist_emails was SELECT-able by ANY authenticated
--   user (USING true). Reads are now service-role only.
-- =============================================================

-- ── 1. Billing columns on families ──────────────────────────────────

alter table public.families
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status text not null default 'incomplete',
  add column if not exists plan_id text not null default 'none',
  add column if not exists is_founding boolean not null default false,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

-- Statuses: incomplete | trialing | active | past_due | canceled | unpaid | expired
-- plan_id: none | founding | annual | monthly
create index if not exists families_stripe_customer_idx on public.families (stripe_customer_id);
create index if not exists families_stripe_subscription_idx on public.families (stripe_subscription_id);

comment on column public.families.subscription_status is
  'Stripe subscription state: incomplete|trialing|active|past_due|canceled|unpaid|expired. Grandfathered founding families are active with no Stripe rows.';
comment on column public.families.plan_id is
  'none|founding ($39/yr locked)|annual ($99/yr)|monthly ($12/mo)';

-- ── 2. Subscription event log (webhook idempotency + audit) ─────────

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  stripe_event_id text unique not null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_family_idx on public.subscription_events (family_id);

alter table public.subscription_events enable row level security;

drop policy if exists "subscription_events_family" on public.subscription_events;
create policy "subscription_events_family"
  on public.subscription_events for all
  to authenticated
  using (family_id = public.get_my_family_id())
  with check (family_id = public.get_my_family_id());

-- ── 3. Backfill: existing family = grandfathered founding family ────
-- There is exactly one family (pre-launch). It keeps working untouched:
-- full Pro, never billed, marked founding for life.

update public.families
set plan_tier = 'pro',
    plan_id = 'founding',
    is_founding = true,
    subscription_status = 'active',
    trial_ends_at = null,
    current_period_end = null
where subscription_status = 'incomplete';

-- ── 4. Join-by-invite-code via RPC (kills enumeration leak) ──────────

create or replace function public.join_family_with_code(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_existing uuid;
begin
  if p_code is null or length(trim(p_code)) < 6 then
    raise exception 'Invalid invite code';
  end if;

  select id into v_family_id
  from public.families
  where upper(invite_code) = upper(trim(p_code))
  limit 1;

  if v_family_id is null then
    raise exception 'Invite code not found';
  end if;

  -- Idempotent: already a member → just return the family
  select id into v_existing
  from public.family_members
  where family_id = v_family_id and user_id = auth.uid()
  limit 1;

  if v_existing is not null then
    return v_family_id;
  end if;

  insert into public.family_members (family_id, user_id, display_name, role, avatar_color)
  values (
    v_family_id,
    auth.uid(),
    coalesce(nullif(trim(p_display_name), ''), 'Member'),
    'member',
    '#5B7FB5'
  );

  return v_family_id;
end;
$$;

grant execute on function public.join_family_with_code(text, text) to authenticated;

-- Drop the broad policy that let any authenticated user list every family
-- (id, name, invite_code) — the join flow now uses the RPC above.
drop policy if exists "families_select_by_invite_code" on public.families;

-- ── 5. waitlist_emails: service-role reads only ──────────────────────

drop policy if exists "Owner can read waitlist" on public.waitlist_emails;
-- No authenticated SELECT policy remains: reads require the service role
-- (Supabase dashboard / server-side). Public anon INSERT is untouched.
