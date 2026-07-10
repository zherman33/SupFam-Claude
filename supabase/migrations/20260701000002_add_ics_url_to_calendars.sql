-- Add ics_url and account_email columns to connected_calendars for Outlook/iCal subscription links
ALTER TABLE public.connected_calendars
  ADD COLUMN IF NOT EXISTS ics_url text,
  ADD COLUMN IF NOT EXISTS account_email text;
