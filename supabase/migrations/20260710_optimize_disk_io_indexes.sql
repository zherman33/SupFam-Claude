-- =============================================================
-- Optimization: Add composite indexes to reduce Disk IO (Seq Scans)
-- =============================================================

-- 1. Index on family_members(user_id, family_id) for get_my_family_id() & RLS checks
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON public.family_members(family_id);

-- 2. Indexes on calendar_events for window queries, deduplication & foreign keys
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_window ON public.calendar_events(family_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_external_id ON public.calendar_events(family_id, external_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source_cal ON public.calendar_events(family_id, source_calendar_id);

-- 3. Indexes on tasks for queries & sync
CREATE INDEX IF NOT EXISTS idx_tasks_family_due_complete ON public.tasks(family_id, is_complete, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_google_id ON public.tasks(family_id, google_task_id);

-- 4. Indexes on connected_calendars & google_tokens
CREATE INDEX IF NOT EXISTS idx_connected_calendars_member ON public.connected_calendars(family_member_id);
CREATE INDEX IF NOT EXISTS idx_google_tokens_member ON public.google_tokens(family_member_id);
