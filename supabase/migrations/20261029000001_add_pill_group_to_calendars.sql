-- Add pill_group column to connected_calendars for user-defined calendar groups
-- (one home-screen pill toggles every calendar in the group on or off together)
ALTER TABLE public.connected_calendars
  ADD COLUMN IF NOT EXISTS pill_group text;
