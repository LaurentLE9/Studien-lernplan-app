-- Explicit Supabase Data API grants for public schema objects.
-- RLS policies remain unchanged and continue to enforce per-user access.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.user_plans,
  public.subject_groups,
  public.semesters,
  public.subjects,
  public.topics,
  public.exams,
  public.timer_sessions,
  public.study_time_entries
TO authenticated;

GRANT SELECT ON TABLE
  public.topic_time_stats,
  public.subject_time_stats
TO authenticated;

NOTIFY pgrst, 'reload schema';
