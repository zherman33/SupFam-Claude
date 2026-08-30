-- Add position column to tasks table for ordering unscheduled tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position INTEGER;
