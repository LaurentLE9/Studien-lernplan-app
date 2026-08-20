-- KAN-40: cover the composite subject-to-semester foreign key.
CREATE INDEX IF NOT EXISTS idx_subjects_semester_user_id
  ON public.subjects(semester_id, user_id);
