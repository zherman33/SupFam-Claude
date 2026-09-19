-- Promo codes: let testers (and Zac) bypass Stripe checkout during onboarding.
-- Redeemed via the SECURITY DEFINER function redeem_promo_code(text).

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan_id text not null check (plan_id in ('founding', 'annual', 'monthly')),
  max_uses integer not null default 1,
  used_count integer not null default 0,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;
-- Intentionally no policies: only the SECURITY DEFINER function below touches it.

create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_promo record;
  v_fam record;
begin
  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('ok', false, 'error', 'Enter a code.');
  end if;

  select * into v_member
  from public.family_members
  where user_id = auth.uid()
  limit 1;

  if v_member is null then
    return jsonb_build_object('ok', false, 'error', 'No family found for this account yet.');
  end if;
  if v_member.role <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Only the family admin can redeem a code.');
  end if;

  select * into v_promo
  from public.promo_codes
  where upper(code) = upper(btrim(p_code))
    and active = true;

  if v_promo is null then
    return jsonb_build_object('ok', false, 'error', 'That code didn''t work — check it and try again.');
  end if;
  if v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object('ok', false, 'error', 'That code has already been used up.');
  end if;

  select * into v_fam from public.families where id = v_member.family_id;
  if v_fam.subscription_status in ('trialing', 'active', 'past_due') then
    return jsonb_build_object('ok', false, 'error', 'This family already has an active plan.');
  end if;

  update public.families set
    plan_id = v_promo.plan_id,
    subscription_status = 'active',
    is_founding = (v_promo.plan_id = 'founding'),
    trial_ends_at = null,
    stripe_subscription_id = null,
    current_period_end = now() + interval '1 year',
    cancel_at_period_end = false
  where id = v_member.family_id;

  update public.promo_codes
  set used_count = used_count + 1
  where id = v_promo.id;

  return jsonb_build_object('ok', true, 'plan', v_promo.plan_id);
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;

insert into public.promo_codes (code, plan_id, max_uses, note)
values ('SUPFAM-TEST', 'founding', 100, 'Zac testing bypass — skips Stripe checkout')
on conflict (code) do nothing;
