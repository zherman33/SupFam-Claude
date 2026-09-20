-- Product analytics for the embedded UX admin dashboard.
--
-- product_events: one row per client-side product event (signup, onboarding
-- steps, family changes, app heartbeats). Written by the app via the anon
-- key; readable only by staff (see staff_emails + is_staff()).
--
-- Screen time is derived from app_heartbeat rows (one per minute while the
-- app is visible): sum(heartbeats) * 60s per family per day.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid null references public.families (id) on delete cascade,
  user_id uuid null,
  member_id uuid null references public.family_members (id) on delete set null,
  session_id text not null,
  event text not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists product_events_event_time_idx
  on public.product_events (event, occurred_at desc);
create index if not exists product_events_family_time_idx
  on public.product_events (family_id, occurred_at desc);
create index if not exists product_events_session_idx
  on public.product_events (session_id, occurred_at);
create index if not exists product_events_user_time_idx
  on public.product_events (user_id, occurred_at desc);

-- Staff allowlist: Sup Fam team members who may view product analytics.
-- Seed with the founder's sign-in email; add more with a plain INSERT.
create table if not exists public.staff_emails (
  email text primary key,
  added_at timestamptz not null default now()
);

insert into public.staff_emails (email)
values ('z33herman@gmail.com')
on conflict (email) do nothing;

-- SECURITY DEFINER so anon/authenticated callers can check their own
-- staff status without being able to read the allowlist table.
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.staff_emails
    where lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

alter table public.product_events enable row level security;
alter table public.staff_emails enable row level security;

-- Clients may only append their own events; no reads, no updates, no deletes.
drop policy if exists product_events_insert_own on public.product_events;
create policy product_events_insert_own
  on public.product_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Staff can read everything (drives the UX dashboard).
drop policy if exists product_events_select_staff on public.product_events;
create policy product_events_select_staff
  on public.product_events
  for select
  to authenticated
  using (public.is_staff());

-- The allowlist itself is visible to staff only.
drop policy if exists staff_emails_select_staff on public.staff_emails;
create policy staff_emails_select_staff
  on public.staff_emails
  for select
  to authenticated
  using (public.is_staff());
