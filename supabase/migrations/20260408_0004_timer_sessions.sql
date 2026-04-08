-- Persistent timer sessions for dashboard stopwatch/pomodoro restore

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.timer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'stopwatch' CHECK (mode IN ('stopwatch', 'pomodoro')),
  preset_minutes integer NOT NULL DEFAULT 90 CHECK (preset_minutes > 0),
  started_at timestamp with time zone NOT NULL,
  paused_at timestamp with time zone,
  total_pause_seconds integer NOT NULL DEFAULT 0 CHECK (total_pause_seconds >= 0),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'finished', 'cancelled')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_id ON public.timer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_subject_id ON public.timer_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_status ON public.timer_sessions(status);

-- Exactly one active timer (running/paused) per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_timer_sessions_active_per_user
  ON public.timer_sessions(user_id)
  WHERE status IN ('running', 'paused');

CREATE OR REPLACE FUNCTION public.update_timer_sessions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_timer_sessions_updated_at ON public.timer_sessions;
CREATE TRIGGER tr_timer_sessions_updated_at
BEFORE UPDATE ON public.timer_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_timer_sessions_updated_at();

ALTER TABLE public.timer_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timer_sessions_select_own" ON public.timer_sessions;
CREATE POLICY "timer_sessions_select_own"
ON public.timer_sessions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "timer_sessions_insert_own" ON public.timer_sessions;
CREATE POLICY "timer_sessions_insert_own"
ON public.timer_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "timer_sessions_update_own" ON public.timer_sessions;
CREATE POLICY "timer_sessions_update_own"
ON public.timer_sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "timer_sessions_delete_own" ON public.timer_sessions;
CREATE POLICY "timer_sessions_delete_own"
ON public.timer_sessions FOR DELETE
USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
