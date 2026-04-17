-- Learning plan v2: split planning into subject-level new-topic cadence and topic-level review cadence

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS include_in_learning_plan boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority integer,
  ADD COLUMN IF NOT EXISTS new_topic_every_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_new_topic_due_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_new_topic_every_days_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_new_topic_every_days_check CHECK (new_topic_every_days >= 1);

CREATE INDEX IF NOT EXISTS idx_subjects_learning_plan_active ON public.subjects(include_in_learning_plan, paused, is_archived);
CREATE INDEX IF NOT EXISTS idx_subjects_next_new_topic_due_at ON public.subjects(next_new_topic_due_at);
CREATE INDEX IF NOT EXISTS idx_subjects_priority ON public.subjects(priority);

CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'review')),
  last_studied_at timestamp with time zone,
  next_review_at timestamp with time zone,
  review_step integer NOT NULL DEFAULT 0 CHECK (review_step >= 0),
  completed boolean NOT NULL DEFAULT false,
  is_paused_today boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON public.topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON public.topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_next_review_at ON public.topics(next_review_at);
CREATE INDEX IF NOT EXISTS idx_topics_status ON public.topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_due_lookup ON public.topics(user_id, next_review_at, status);
CREATE INDEX IF NOT EXISTS idx_topics_subject_order ON public.topics(subject_id, order_index);

CREATE UNIQUE INDEX IF NOT EXISTS uq_topics_subject_title ON public.topics(subject_id, lower(title));

-- Keep timestamps accurate for subjects and topics.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_subjects_updated_at ON public.subjects;
CREATE TRIGGER tr_subjects_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS tr_topics_updated_at ON public.topics;
CREATE TRIGGER tr_topics_updated_at
BEFORE UPDATE ON public.topics
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topics_select_own" ON public.topics;
CREATE POLICY "topics_select_own"
ON public.topics FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "topics_insert_own" ON public.topics;
CREATE POLICY "topics_insert_own"
ON public.topics FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "topics_update_own" ON public.topics;
CREATE POLICY "topics_update_own"
ON public.topics FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "topics_delete_own" ON public.topics;
CREATE POLICY "topics_delete_own"
ON public.topics FOR DELETE
USING (auth.uid() = user_id);

-- Existing subjects stay untouched; they now get defaults for plan-level fields.
UPDATE public.subjects
SET
  include_in_learning_plan = COALESCE(include_in_learning_plan, true),
  new_topic_every_days = GREATEST(1, COALESCE(new_topic_every_days, 3)),
  paused = COALESCE(paused, false)
WHERE true;

NOTIFY pgrst, 'reload schema';
