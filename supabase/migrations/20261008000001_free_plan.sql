-- Free plan: lets a family use Sup Fam without Stripe checkout or a card.
-- Chosen during onboarding via the SECURITY DEFINER function choose_free_plan().

create or replace function public.choose_free_plan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_fam record;
begin
  select * into v_member
  from public.family_members
  where user_id = auth.uid()
  limit 1;

  if v_member is null then
    return jsonb_build_object('ok', false, 'error', 'No family found for this account yet.');
  end if;
  if v_member.role <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Only the family admin can choose the plan.');
  end if;

  select * into v_fam from public.families where id = v_member.family_id;
  if v_fam.subscription_status in ('trialing', 'active', 'past_due', 'free') then
    return jsonb_build_object('ok', false, 'error', 'This family already has a plan.');
  end if;

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

  return jsonb_build_object('ok', true, 'plan', 'free');
end;
$$;

grant execute on function public.choose_free_plan() to authenticated;
