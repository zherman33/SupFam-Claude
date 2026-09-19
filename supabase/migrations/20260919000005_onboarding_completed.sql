-- Explicit onboarding completion. The derived step in useOnboardingStep could
-- never reach 'done' for users who skipped calendar connection (calCount = 0)
-- or hadn't invited anyone yet (members < 2), so "Enter Sup Fam" bounced them
-- back into onboarding forever. Now the button records completion per member.

alter table public.family_members
  add column if not exists onboarding_completed boolean not null default false;

create or replace function public.complete_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.family_members
  set onboarding_completed = true
  where user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No family found for this account yet.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.complete_onboarding() to authenticated;
