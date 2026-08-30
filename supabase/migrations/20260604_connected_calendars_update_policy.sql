-- Allow family members to update connected calendars in the same family
-- (So they can customize calendar colors or visibility from the shared dashboard)
DROP POLICY IF EXISTS "connected_calendars_update" ON public.connected_calendars;

CREATE POLICY "connected_calendars_update"
  ON public.connected_calendars FOR UPDATE TO authenticated
  USING (
    family_member_id IN (
      SELECT id FROM public.family_members
      WHERE family_id = public.get_my_family_id()
    )
  )
  WITH CHECK (
    family_member_id IN (
      SELECT id FROM public.family_members
      WHERE family_id = public.get_my_family_id()
    )
  );
