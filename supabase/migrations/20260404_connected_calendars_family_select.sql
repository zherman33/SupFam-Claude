-- Allow family members to see each other's connected calendars
-- Previous policy only showed your own rows (user_id = auth.uid() scoped).
-- New policy: anyone in the same family can see all family calendar rows.
DROP POLICY IF EXISTS "connected_calendars_select" ON public.connected_calendars;
CREATE POLICY "connected_calendars_select"
  ON public.connected_calendars FOR SELECT TO authenticated
  USING (
    family_member_id IN (
      SELECT id FROM public.family_members
      WHERE family_id = public.get_my_family_id()
    )
  );
