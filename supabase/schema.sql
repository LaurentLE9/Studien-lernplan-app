-- Studien Lernplan App - Cloud Schema
-- Ausfuehren im Supabase SQL Editor

create table if not exists public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_plans_updated_at on public.user_plans;
create trigger trg_user_plans_updated_at
before update on public.user_plans
for each row
execute procedure public.set_updated_at();

alter table public.user_plans enable row level security;

drop policy if exists "user_plans_select_own" on public.user_plans;
create policy "user_plans_select_own"
on public.user_plans
for select
using (auth.uid() = user_id);

drop policy if exists "user_plans_insert_own" on public.user_plans;
create policy "user_plans_insert_own"
on public.user_plans
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_plans_update_own" on public.user_plans;
create policy "user_plans_update_own"
on public.user_plans
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
