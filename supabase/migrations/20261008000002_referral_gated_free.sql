-- Free plan is referral-only, not public (2026-10-08 correction).
--
-- 1. promo_codes can now grant plan_id='free' — the single mechanism for
--    free access. Zac mints codes; referred people redeem them at the
--    plan step ("Have a promo code?"). No public free card.
-- 2. redeem_promo_code stamps status='free' (not 'active') for free codes,
--    and treats 'free' families as already having a plan.
-- 3. Drops choose_free_plan() — the public no-code RPC must not exist.

alter table public.promo_codes drop constraint promo_codes_plan_id_check;
alter table public.promo_codes
  add constraint promo_codes_plan_id_check
  check (plan_id in ('founding', 'annual', 'monthly', 'free'));

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
  if v_fam.subscription_status in ('trialing', 'active', 'past_due', 'free') then
    return jsonb_build_object('ok', false, 'error', 'This family already has a plan.');
  end if;

  if v_promo.plan_id = 'free' then
    -- Referral free plan: full access, no Stripe, no renewal clock.
    update public.families set
      plan_id = 'free',
      subscription_status = 'free',
      is_founding = false,
      trial_ends_at = null,
      stripe_customer_id = null,
      stripe_subscription_id = null,
      current_period_end = null,
      cancel_at_period_end = false
    where id = v_member.family_id;
  else
    update public.families set
      plan_id = v_promo.plan_id,
      subscription_status = 'active',
      is_founding = (v_promo.plan_id = 'founding'),
      trial_ends_at = null,
      stripe_subscription_id = null,
      current_period_end = now() + interval '1 year',
      cancel_at_period_end = false
    where id = v_member.family_id;
  end if;

  update public.promo_codes
  set used_count = used_count + 1
  where id = v_promo.id;

  return jsonb_build_object('ok', true, 'plan', v_promo.plan_id);
end;
$$;

drop function if exists public.choose_free_plan();

-- Starter set of single-use referral codes for Zac to hand out.
insert into public.promo_codes (code, plan_id, max_uses, note)
select 'ZAC-' || upper(substring(md5(random()::text), 1, 6)), 'free', 1, 'Zac referral — free plan'
from generate_series(1, 5)
on conflict (code) do nothing;
