-- Ensure new subjects are opt-in for the learning plan.
ALTER TABLE public.subjects
  ALTER COLUMN include_in_learning_plan SET DEFAULT false;

UPDATE public.subjects
SET include_in_learning_plan = false
WHERE include_in_learning_plan IS NULL;

NOTIFY pgrst, 'reload schema';
