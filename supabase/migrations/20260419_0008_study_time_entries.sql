-- Study time entries: flexible time tracking linked to subjects and optional topics

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.study_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'stopwatch', 'pomodoro')),
  notes text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_time_entries_user_id ON public.study_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_subject_id ON public.study_time_entries(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_topic_id ON public.study_time_entries(topic_id);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_recorded_at ON public.study_time_entries(recorded_at);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_created_at ON public.study_time_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_user_recorded ON public.study_time_entries(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_subject_recorded ON public.study_time_entries(subject_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.update_study_time_entries_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_study_time_entries_updated_at ON public.study_time_entries;
CREATE TRIGGER tr_study_time_entries_updated_at
BEFORE UPDATE ON public.study_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_study_time_entries_updated_at();

ALTER TABLE public.study_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_time_entries_select_own" ON public.study_time_entries;
CREATE POLICY "study_time_entries_select_own"
ON public.study_time_entries FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_time_entries_insert_own" ON public.study_time_entries;
CREATE POLICY "study_time_entries_insert_own"
ON public.study_time_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_time_entries_update_own" ON public.study_time_entries;
CREATE POLICY "study_time_entries_update_own"
ON public.study_time_entries FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_time_entries_delete_own" ON public.study_time_entries;
CREATE POLICY "study_time_entries_delete_own"
ON public.study_time_entries FOR DELETE
USING (auth.uid() = user_id);

-- Create a view for task-level time statistics (optional but helpful for queries)
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

-- Subject-level time statistics view
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
