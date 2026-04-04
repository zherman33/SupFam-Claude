-- =============================================================
-- FIX: RLS infinite recursion on family_members
-- Root cause: SELECT policy on family_members referenced itself
-- Fix: SECURITY DEFINER function bypasses RLS entirely
-- =============================================================

-- 1. Create the helper function (runs without RLS, no recursion)
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT family_id
  FROM public.family_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_family_id() TO authenticated;

-- 2. family_members — clean policies (no self-reference)
DROP POLICY IF EXISTS "Family members can view each other" ON public.family_members;
DROP POLICY IF EXISTS "Users can join a family" ON public.family_members;
DROP POLICY IF EXISTS "Users can update their profile" ON public.family_members;
DROP POLICY IF EXISTS "Users can leave a family" ON public.family_members;
DROP POLICY IF EXISTS "family_members_select" ON public.family_members;
DROP POLICY IF EXISTS "family_members_insert" ON public.family_members;
DROP POLICY IF EXISTS "family_members_update" ON public.family_members;
DROP POLICY IF EXISTS "family_members_delete" ON public.family_members;

CREATE POLICY "family_members_select" ON public.family_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR family_id = public.get_my_family_id());

CREATE POLICY "family_members_insert" ON public.family_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "family_members_update" ON public.family_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "family_members_delete" ON public.family_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. families
DROP POLICY IF EXISTS "Family members can view their family" ON public.families;
DROP POLICY IF EXISTS "Authenticated users can create a family" ON public.families;
DROP POLICY IF EXISTS "Admins can update their family" ON public.families;
DROP POLICY IF EXISTS "families_select" ON public.families;
DROP POLICY IF EXISTS "families_insert" ON public.families;
DROP POLICY IF EXISTS "families_update" ON public.families;

CREATE POLICY "families_select" ON public.families FOR SELECT TO authenticated
  USING (id = public.get_my_family_id());

CREATE POLICY "families_insert" ON public.families FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "families_update" ON public.families FOR UPDATE TO authenticated
  USING (id = public.get_my_family_id());

-- 4. tasks
DROP POLICY IF EXISTS "Family members can access their tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (family_id = public.get_my_family_id());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (family_id = public.get_my_family_id());

-- 5. grocery_items
DROP POLICY IF EXISTS "Family members can access their grocery items" ON public.grocery_items;
DROP POLICY IF EXISTS "grocery_items_select" ON public.grocery_items;
DROP POLICY IF EXISTS "grocery_items_insert" ON public.grocery_items;
DROP POLICY IF EXISTS "grocery_items_update" ON public.grocery_items;
DROP POLICY IF EXISTS "grocery_items_delete" ON public.grocery_items;

CREATE POLICY "grocery_items_select" ON public.grocery_items FOR SELECT TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "grocery_items_insert" ON public.grocery_items FOR INSERT TO authenticated WITH CHECK (family_id = public.get_my_family_id());
CREATE POLICY "grocery_items_update" ON public.grocery_items FOR UPDATE TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "grocery_items_delete" ON public.grocery_items FOR DELETE TO authenticated USING (family_id = public.get_my_family_id());

-- 6. notes
DROP POLICY IF EXISTS "Family members can access their notes" ON public.notes;
DROP POLICY IF EXISTS "notes_select" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
DROP POLICY IF EXISTS "notes_update" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;

CREATE POLICY "notes_select" ON public.notes FOR SELECT TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "notes_insert" ON public.notes FOR INSERT TO authenticated WITH CHECK (family_id = public.get_my_family_id());
CREATE POLICY "notes_update" ON public.notes FOR UPDATE TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "notes_delete" ON public.notes FOR DELETE TO authenticated USING (family_id = public.get_my_family_id());

-- 7. calendar_events
DROP POLICY IF EXISTS "calendar_events_select" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_update" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete" ON public.calendar_events;

CREATE POLICY "calendar_events_select" ON public.calendar_events FOR SELECT TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "calendar_events_insert" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (family_id = public.get_my_family_id());
CREATE POLICY "calendar_events_update" ON public.calendar_events FOR UPDATE TO authenticated USING (family_id = public.get_my_family_id());
CREATE POLICY "calendar_events_delete" ON public.calendar_events FOR DELETE TO authenticated USING (family_id = public.get_my_family_id());

-- 8. connected_calendars (scoped to user's own member records — no family_id column)
DROP POLICY IF EXISTS "Users can manage their own calendar connections" ON public.connected_calendars;
DROP POLICY IF EXISTS "Family members can view connected calendars" ON public.connected_calendars;
DROP POLICY IF EXISTS "connected_calendars_select" ON public.connected_calendars;
DROP POLICY IF EXISTS "connected_calendars_insert" ON public.connected_calendars;
DROP POLICY IF EXISTS "connected_calendars_update" ON public.connected_calendars;
DROP POLICY IF EXISTS "connected_calendars_delete" ON public.connected_calendars;

CREATE POLICY "connected_calendars_select" ON public.connected_calendars FOR SELECT TO authenticated
  USING (family_member_id IN (SELECT id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "connected_calendars_insert" ON public.connected_calendars FOR INSERT TO authenticated
  WITH CHECK (family_member_id IN (SELECT id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "connected_calendars_update" ON public.connected_calendars FOR UPDATE TO authenticated
  USING (family_member_id IN (SELECT id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "connected_calendars_delete" ON public.connected_calendars FOR DELETE TO authenticated
  USING (family_member_id IN (SELECT id FROM public.family_members WHERE user_id = auth.uid()));
