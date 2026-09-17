-- Meal planning: weekly dinner board (flagship Pro feature)
-- + grocery_items source tracking + families.plan_tier for the future Pro paywall

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  week_start date not null, -- Monday of the planned week (yyyy-MM-dd)
  created_by uuid references public.family_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, week_start)
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day_index smallint not null check (day_index between 0 and 6), -- 0 = Monday
  slot text not null default 'dinner',
  title text not null,
  notes text,
  recipe_url text,
  servings smallint not null default 4,
  created_at timestamptz not null default now(),
  unique (meal_plan_id, day_index, slot)
);

create table if not exists public.meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text,
  position smallint not null default 0
);

-- Track where grocery items came from so "Build grocery list" can dedupe
-- and the UI can show "from this week's dinner board".
alter table public.grocery_items
  add column if not exists source text not null default 'manual',
  add column if not exists meal_plan_id uuid references public.meal_plans(id) on delete set null;

-- Pro tier lives on the family so a future Stripe webhook can flip it.
-- Founding beta: every family that exists today keeps Pro.
alter table public.families
  add column if not exists plan_tier text not null default 'free';

update public.families set plan_tier = 'pro' where plan_tier = 'free';

-- ── RLS ───────────────────────────────────────────────────────────────────

alter table public.meal_plans enable row level security;
alter table public.meals enable row level security;
alter table public.meal_ingredients enable row level security;

drop policy if exists "meal_plans_family" on public.meal_plans;
create policy "meal_plans_family"
  on public.meal_plans for all
  to authenticated
  using (family_id in (select family_id from public.family_members where user_id = auth.uid()))
  with check (family_id in (select family_id from public.family_members where user_id = auth.uid()));

drop policy if exists "meals_family" on public.meals;
create policy "meals_family"
  on public.meals for all
  to authenticated
  using (
    meal_plan_id in (
      select mp.id from public.meal_plans mp
      join public.family_members fm on fm.family_id = mp.family_id
      where fm.user_id = auth.uid()
    )
  )
  with check (
    meal_plan_id in (
      select mp.id from public.meal_plans mp
      join public.family_members fm on fm.family_id = mp.family_id
      where fm.user_id = auth.uid()
    )
  );

drop policy if exists "meal_ingredients_family" on public.meal_ingredients;
create policy "meal_ingredients_family"
  on public.meal_ingredients for all
  to authenticated
  using (
    meal_id in (
      select m.id from public.meals m
      join public.meal_plans mp on mp.id = m.meal_plan_id
      join public.family_members fm on fm.family_id = mp.family_id
      where fm.user_id = auth.uid()
    )
  )
  with check (
    meal_id in (
      select m.id from public.meals m
      join public.meal_plans mp on mp.id = m.meal_plan_id
      join public.family_members fm on fm.family_id = mp.family_id
      where fm.user_id = auth.uid()
    )
  );

-- Helpful indexes
create index if not exists meal_plans_family_week_idx on public.meal_plans (family_id, week_start);
create index if not exists meals_plan_day_idx on public.meals (meal_plan_id, day_index);
create index if not exists meal_ingredients_meal_idx on public.meal_ingredients (meal_id);
create index if not exists grocery_items_meal_plan_idx on public.grocery_items (meal_plan_id);
