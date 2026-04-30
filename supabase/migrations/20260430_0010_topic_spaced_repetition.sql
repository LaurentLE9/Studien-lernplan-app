-- Topic-based learning plan metadata and study entry review fields.
-- This migration is additive and keeps study_time_entries.topic_id type-compatible
-- with public.topics.id. In the current schema both are uuid and remain uuid.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS cheatsheet_text text,
  ADD COLUMN IF NOT EXISTS cheatsheet_url text,
  ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'unsure',
  ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

UPDATE public.topics
SET
  confidence = COALESCE(confidence, 'unsure'),
  review_count = COALESCE(review_count, 0)
WHERE confidence IS NULL
   OR review_count IS NULL;

-- Existing schemas may still have the legacy status check ('new', 'learning', 'review').
-- Status is intentionally normalized in application code, so do not add a new hard check here.
ALTER TABLE public.topics
  DROP CONSTRAINT IF EXISTS topics_status_check;

ALTER TABLE public.topics
  DROP CONSTRAINT IF EXISTS topics_review_count_check;

ALTER TABLE public.topics
  ADD CONSTRAINT topics_review_count_check CHECK (review_count >= 0);

ALTER TABLE public.study_time_entries
  ADD COLUMN IF NOT EXISTS task_id text,
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS review_updated boolean DEFAULT false;

UPDATE public.study_time_entries
SET review_updated = COALESCE(review_updated, false)
WHERE review_updated IS NULL;

-- Add topic_id only if it is missing, matching the type of public.topics.id.
DO $$
DECLARE
  topics_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO topics_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'topics'
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF topics_id_type IS NULL THEN
    RAISE EXCEPTION 'public.topics.id was not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'study_time_entries'
      AND column_name = 'topic_id'
  ) THEN
    EXECUTE format('ALTER TABLE public.study_time_entries ADD COLUMN topic_id %s', topics_id_type);
  END IF;
END $$;

-- Ensure any FK from study_time_entries.topic_id to topics(id) is ON DELETE SET NULL.
DO $$
DECLARE
  constraint_record record;
  entry_topic_type text;
  topics_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO entry_topic_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'study_time_entries'
    AND a.attname = 'topic_id'
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO topics_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'topics'
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF entry_topic_type IS NULL OR topics_id_type IS NULL THEN
    RETURN;
  END IF;

  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class source_table ON source_table.oid = con.conrelid
    JOIN pg_namespace source_schema ON source_schema.oid = source_table.relnamespace
    JOIN pg_class target_table ON target_table.oid = con.confrelid
    JOIN pg_namespace target_schema ON target_schema.oid = target_table.relnamespace
    WHERE con.contype = 'f'
      AND source_schema.nspname = 'public'
      AND source_table.relname = 'study_time_entries'
      AND target_schema.nspname = 'public'
      AND target_table.relname = 'topics'
      AND con.conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = source_table.oid
            AND attname = 'topic_id'
            AND NOT attisdropped
        )
      ]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.study_time_entries DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;

  IF entry_topic_type = topics_id_type THEN
    ALTER TABLE public.study_time_entries
      ADD CONSTRAINT study_time_entries_topic_id_fkey
      FOREIGN KEY (topic_id)
      REFERENCES public.topics(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topics_confidence ON public.topics(confidence);
CREATE INDEX IF NOT EXISTS idx_topics_archived_at ON public.topics(archived_at);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_topic_id ON public.study_time_entries(topic_id);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_task_id ON public.study_time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_activity_type ON public.study_time_entries(activity_type);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_review_updated ON public.study_time_entries(review_updated);

-- Refresh helper views so new columns do not disturb existing topic_id joins.
CREATE OR REPLACE VIEW public.topic_time_stats AS
SELECT
  t.id AS topic_id,
  t.subject_id,
  t.user_id,
  t.title AS topic_title,
  s.name AS subject_name,
  COALESCE(SUM(e.duration_minutes), 0) AS total_minutes,
  COUNT(e.id) AS entry_count,
  MAX(e.recorded_at) AS last_recorded_at
FROM public.topics t
LEFT JOIN public.subjects s ON t.subject_id = s.id
LEFT JOIN public.study_time_entries e ON t.id = e.topic_id AND e.user_id = t.user_id
GROUP BY t.id, t.subject_id, t.user_id, t.title, s.name;

CREATE OR REPLACE VIEW public.subject_time_stats AS
SELECT
  s.id AS subject_id,
  s.user_id,
  s.name AS subject_name,
  COALESCE(SUM(e.duration_minutes), 0) AS total_minutes,
  COUNT(e.id) AS entry_count,
  MAX(e.recorded_at) AS last_recorded_at
FROM public.subjects s
LEFT JOIN public.study_time_entries e ON s.id = e.subject_id AND e.user_id = s.user_id
GROUP BY s.id, s.user_id, s.name;

NOTIFY pgrst, 'reload schema';
