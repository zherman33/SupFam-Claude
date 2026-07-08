-- Add is_quick_toggle column to connected_calendars for pinning calendar toggle to the main screen
ALTER TABLE public.connected_calendars
  ADD COLUMN IF NOT EXISTS is_quick_toggle boolean DEFAULT false;
