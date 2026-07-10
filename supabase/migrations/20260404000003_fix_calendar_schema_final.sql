-- Drop legacy token columns from connected_calendars
ALTER TABLE public.connected_calendars
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS token_expires_at;

-- Change source_calendar_id from UUID to TEXT
ALTER TABLE public.calendar_events
  ALTER COLUMN source_calendar_id TYPE text USING source_calendar_id::text;

-- Drop broken FK and duplicate constraint
ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_source_calendar_id_fkey,
  DROP CONSTRAINT IF EXISTS calendar_events_family_id_external_event_id_key;
