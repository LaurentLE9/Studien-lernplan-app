-- Subject-level learning plan state for spaced repetition by subject

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS last_studied_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS next_review_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS review_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_studied_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS study_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_review_step_check,
  DROP CONSTRAINT IF EXISTS subjects_last_studied_minutes_check,
  DROP CONSTRAINT IF EXISTS subjects_study_count_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_review_step_check CHECK (review_step >= 0),
  ADD CONSTRAINT subjects_last_studied_minutes_check CHECK (last_studied_minutes >= 0),
  ADD CONSTRAINT subjects_study_count_check CHECK (study_count >= 0);

CREATE INDEX IF NOT EXISTS idx_subjects_next_review_at ON public.subjects(next_review_at);
CREATE INDEX IF NOT EXISTS idx_subjects_last_studied_at ON public.subjects(last_studied_at);

NOTIFY pgrst, 'reload schema';
