-- Fix families INSERT policy
-- auth.role() = 'authenticated' is unreliable in WITH CHECK clauses on Supabase
-- (PostgREST sets the role to 'authenticated' but auth.role() can still return 'anon'
-- inside certain policy evaluation contexts)
-- Use auth.uid() IS NOT NULL instead — works correctly every time

DROP POLICY IF EXISTS "families_insert" ON public.families;

CREATE POLICY "families_insert"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
