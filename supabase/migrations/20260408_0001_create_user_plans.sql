-- Create the persistent per-user planner storage in the public schema.
-- Apply this in Supabase SQL Editor or as a migration, then refresh the schema cache.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.user_plans (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{"subjects":[],"tasks":[],"studySessions":[],"todayFocus":[],"settings":{"appearance":"light","sidebarCollapsed":false,"dashboardLayout":["stats","deadlines","hours","today","recent","done"],"deadlineWidget":{"activeFilter":"all","defaultFilter":"all"}},"seeds":{"tasks":false,"sessions":false}}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON public.user_plans(user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_plans_updated_at ON public.user_plans;
CREATE TRIGGER update_user_plans_updated_at
BEFORE UPDATE ON public.user_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own plans" ON public.user_plans;
CREATE POLICY "Users can view their own plans"
ON public.user_plans FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own plans" ON public.user_plans;
CREATE POLICY "Users can insert their own plans"
ON public.user_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own plans" ON public.user_plans;
CREATE POLICY "Users can update their own plans"
ON public.user_plans FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own plans" ON public.user_plans;
CREATE POLICY "Users can delete their own plans"
ON public.user_plans FOR DELETE
USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
