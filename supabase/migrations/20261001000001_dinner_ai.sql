-- Dinner board v2: meal ratings, family food preferences, AI conversation history.
-- Powers the "3 recommendations from your history" engine and the voice
-- dinner-planning conversations (day scope + week scope).

-- ── Tables ────────────────────────────────────────────────────────────────

-- One row per family member per dish (title normalized to lowercase).
-- Feeds the recommendation engine: what the family actually liked.
create table if not exists public.meal_ratings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete set null,
  meal_title text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_member_id, meal_title)
);

-- Household-level tastes: restrictions and dislikes filter recommendations,
-- favorites boost them, default_servings pre-fills new meals.
create table if not exists public.family_food_prefs (
  family_id uuid primary key references public.families(id) on delete cascade,
  dietary_restrictions text[] not null default '{}',
  dislikes text[] not null default '{}',
  favorites text[] not null default '{}',
  default_servings smallint not null default 4,
  updated_at timestamptz not null default now()
);

-- Saved voice/text planning sessions so a conversation survives a closed tab.
-- messages: [{ role: 'user' | 'assistant', text, ts }]
create table if not exists public.dinner_conversations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  family_member_id uuid references public.family_members(id) on delete set null,
  scope text not null default 'day' check (scope in ('day', 'week')),
  week_start date not null,
  day_index smallint check (day_index between 0 and 6),
  status text not null default 'open' check (status in ('open', 'done')),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────

alter table public.meal_ratings enable row level security;
alter table public.family_food_prefs enable row level security;
alter table public.dinner_conversations enable row level security;

drop policy if exists "meal_ratings_family" on public.meal_ratings;
create policy "meal_ratings_family"
  on public.meal_ratings for all
  to authenticated
  using (family_id in (select family_id from public.family_members where user_id = auth.uid()))
  with check (family_id in (select family_id from public.family_members where user_id = auth.uid()));

drop policy if exists "family_food_prefs_family" on public.family_food_prefs;
create policy "family_food_prefs_family"
  on public.family_food_prefs for all
  to authenticated
  using (family_id in (select family_id from public.family_members where user_id = auth.uid()))
  with check (family_id in (select family_id from public.family_members where user_id = auth.uid()));

drop policy if exists "dinner_conversations_family" on public.dinner_conversations;
create policy "dinner_conversations_family"
  on public.dinner_conversations for all
  to authenticated
  using (family_id in (select family_id from public.family_members where user_id = auth.uid()))
  with check (family_id in (select family_id from public.family_members where user_id = auth.uid()));

-- ── Indexes ───────────────────────────────────────────────────────────────

create index if not exists meal_ratings_family_idx on public.meal_ratings (family_id);
create index if not exists meal_ratings_title_idx on public.meal_ratings (family_id, meal_title);
create index if not exists dinner_conversations_family_idx
  on public.dinner_conversations (family_id, updated_at desc);
