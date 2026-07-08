-- Add google_task_id and google_tasklist_id columns to tasks table for Google Tasks synchronization
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS google_task_id text,
  ADD COLUMN IF NOT EXISTS google_tasklist_id text;
