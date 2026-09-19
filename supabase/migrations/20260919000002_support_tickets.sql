-- =============================================================
-- In-app support: async message form -> support_tickets table.
-- A Supabase Edge Function (support-chat) writes the row and forwards
-- the message to support@supfam.app via Resend.
-- =============================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
-- status: open | replied | closed

create index if not exists support_tickets_family_idx on public.support_tickets (family_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_family" on public.support_tickets;
create policy "support_tickets_family"
  on public.support_tickets for all
  to authenticated
  using (family_id = public.get_my_family_id())
  with check (family_id = public.get_my_family_id());
