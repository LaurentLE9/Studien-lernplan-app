-- Semester Configuration: semesters + subjects linkage via semester_id

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date,
  end_date date,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Keep compatibility with existing schema while ensuring required subject columns exist.
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color text NOT NULL DEFAULT '#3b82f6',
  description text NOT NULL DEFAULT '',
  goal text NOT NULL DEFAULT '',
  target_hours integer NOT NULL DEFAULT 30,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL;

-- Backfill from legacy subject_groups model when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subject_groups'
  ) THEN
    INSERT INTO public.semesters (id, name, user_id, created_at)
    SELECT sg.id, sg.name, sg.user_id, sg.created_at
    FROM public.subject_groups sg
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.subjects s
    SET semester_id = s.group_id
    WHERE s.semester_id IS NULL
      AND s.group_id IS NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_semesters_user_id ON public.semesters(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_semester_id ON public.subjects(semester_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_archived ON public.subjects(is_archived);

ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "semesters_select_own" ON public.semesters;
CREATE POLICY "semesters_select_own"
ON public.semesters FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "semesters_insert_own" ON public.semesters;
CREATE POLICY "semesters_insert_own"
ON public.semesters FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "semesters_update_own" ON public.semesters;
CREATE POLICY "semesters_update_own"
ON public.semesters FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "semesters_delete_own" ON public.semesters;
CREATE POLICY "semesters_delete_own"
ON public.semesters FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subjects_select_own" ON public.subjects;
CREATE POLICY "subjects_select_own"
ON public.subjects FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subjects_insert_own" ON public.subjects;
CREATE POLICY "subjects_insert_own"
ON public.subjects FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subjects_update_own" ON public.subjects;
CREATE POLICY "subjects_update_own"
ON public.subjects FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subjects_delete_own" ON public.subjects;
CREATE POLICY "subjects_delete_own"
ON public.subjects FOR DELETE
USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
