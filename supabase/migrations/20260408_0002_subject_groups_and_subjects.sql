-- Subject management: groups (semester) + subjects with soft delete

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.subject_groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  group_id uuid REFERENCES public.subject_groups(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color text NOT NULL DEFAULT '#3b82f6',
  description text NOT NULL DEFAULT '',
  goal text NOT NULL DEFAULT '',
  target_hours integer NOT NULL DEFAULT 30,
  is_archived boolean NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subject_groups_user_id ON public.subject_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_group_id ON public.subjects(group_id);
CREATE INDEX IF NOT EXISTS idx_subjects_archived ON public.subjects(is_archived);

ALTER TABLE public.subject_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subject_groups_select_own" ON public.subject_groups;
CREATE POLICY "subject_groups_select_own"
ON public.subject_groups FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subject_groups_insert_own" ON public.subject_groups;
CREATE POLICY "subject_groups_insert_own"
ON public.subject_groups FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subject_groups_update_own" ON public.subject_groups;
CREATE POLICY "subject_groups_update_own"
ON public.subject_groups FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subject_groups_delete_own" ON public.subject_groups;
CREATE POLICY "subject_groups_delete_own"
ON public.subject_groups FOR DELETE
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
