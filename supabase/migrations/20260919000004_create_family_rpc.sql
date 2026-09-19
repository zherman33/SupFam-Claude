-- Atomic family creation. The app used to INSERT families then SELECT it back,
-- but families_select requires an existing membership, so the select-back
-- failed RLS for brand-new users (onboarding could never create a family).
-- This SECURITY DEFINER function creates the family + admin membership
-- atomically and returns the new family.

create or replace function public.create_family(p_name text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite text;
  v_family public.families%rowtype;
begin
  if p_name is null or btrim(p_name) = '' then
    return jsonb_build_object('ok', false, 'error', 'Give your family a name.');
  end if;
  if p_display_name is null or btrim(p_display_name) = '' then
    return jsonb_build_object('ok', false, 'error', 'Tell us your name.');
  end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'You already belong to a family.');
  end if;

  -- unique 6-char invite code
  loop
    v_invite := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    exit when not exists (select 1 from public.families where invite_code = v_invite);
  end loop;

  insert into public.families (name, invite_code)
  values (btrim(p_name), v_invite)
  returning * into v_family;

  insert into public.family_members (family_id, user_id, display_name, role, avatar_color)
  values (v_family.id, auth.uid(), btrim(p_display_name), 'admin', '#5B8C5A');

  return jsonb_build_object('ok', true, 'family', jsonb_build_object(
    'id', v_family.id,
    'name', v_family.name,
    'invite_code', v_family.invite_code
  ));
end;
$$;

grant execute on function public.create_family(text, text) to authenticated;
