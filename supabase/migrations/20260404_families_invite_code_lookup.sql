-- Allow any authenticated user to look up a family by invite_code
-- Required so new members can join before they have a family_member row.
-- Without this, get_my_family_id() returns null for new users and
-- the existing families_select policy blocks the lookup entirely.
CREATE POLICY "families_select_by_invite_code"
  ON public.families
  FOR SELECT
  TO authenticated
  USING (
    id = public.get_my_family_id()
    OR invite_code IS NOT NULL
  );
