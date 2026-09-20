-- UX dashboard support: staff read access + server-side screen-time
-- aggregation (raw heartbeats are 1/min/family — far too heavy to
-- pull into the browser for multi-week ranges).

-- Staff can read families + members to power the dashboard's names,
-- member counts, and stuck-family detection.
drop policy if exists families_select_staff on public.families;
create policy families_select_staff
  on public.families
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists family_members_select_staff on public.family_members;
create policy family_members_select_staff
  on public.family_members
  for select
  to authenticated
  using (public.is_staff());

-- Per-family, per-day screen time from app_heartbeat rows.
-- heartbeat_minutes ≈ minutes the app was visible that day;
-- active_hours = distinct hours with at least one heartbeat (drives the
-- "always-on display" badge: >= 20 active hours in a day).
-- Days are bucketed in America/New_York (founder timezone).
create or replace function public.ux_daily_screen_time(p_since timestamptz)
returns table (
  family_id uuid,
  day date,
  heartbeat_minutes bigint,
  active_hours bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.family_id,
    (e.occurred_at at time zone 'America/New_York')::date as day,
    count(*) as heartbeat_minutes,
    count(distinct date_trunc('hour', e.occurred_at)) as active_hours
  from public.product_events e
  where public.is_staff()
    and e.event = 'app_heartbeat'
    and e.family_id is not null
    and e.occurred_at >= p_since
  group by 1, 2
$$;

grant execute on function public.ux_daily_screen_time(timestamptz) to authenticated;

-- Per-user funnel timestamps: first-seen time of each key funnel event
-- per user since p_since. The dashboard derives conversion, drop-off,
-- and median step durations from this (small result set, no heartbeats).
create or replace function public.ux_funnel_first_seen(p_since timestamptz)
returns table (
  user_id uuid,
  family_id uuid,
  event text,
  first_seen timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.user_id,
    (array_agg(e.family_id order by e.occurred_at)
       filter (where e.family_id is not null))[1] as family_id,
    e.event,
    min(e.occurred_at) as first_seen
  from public.product_events e
  where public.is_staff()
    and e.user_id is not null
    and e.event in (
      'signup_viewed', 'account_created', 'onboarding_started',
      'family_created', 'family_joined', 'checkout_started',
      'subscription_activated', 'calendar_connected',
      'family_member_added', 'onboarding_completed'
    )
    and e.occurred_at >= p_since
  group by 1, 3
$$;

grant execute on function public.ux_funnel_first_seen(timestamptz) to authenticated;
