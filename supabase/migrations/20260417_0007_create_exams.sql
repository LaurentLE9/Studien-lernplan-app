-- Create exams table for the Klausuren page
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  exam_date date NOT NULL,
  exam_time time without time zone,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'written')),
  is_archived boolean NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exams_user_id ON public.exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_exam_date ON public.exams(exam_date);

DROP TRIGGER IF EXISTS update_exams_updated_at ON public.exams;
CREATE TRIGGER update_exams_updated_at
BEFORE UPDATE ON public.exams
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exams"
ON public.exams FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exams"
ON public.exams FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exams"
ON public.exams FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exams"
ON public.exams FOR DELETE
USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';