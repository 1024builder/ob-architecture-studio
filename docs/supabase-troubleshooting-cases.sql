-- OB Architecture Studio v0.8.0
-- Run this script in the Supabase SQL editor after the existing sync SQL files.

create table if not exists public.troubleshooting_custom_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  title text not null,
  database_type text not null,
  fault_type text not null,
  severity text not null,
  status text not null default '待验证',
  summary text not null,
  symptoms jsonb not null default '[]'::jsonb,
  impact text not null default '',
  root_cause text not null,
  solution jsonb not null default '[]'::jsonb,
  troubleshooting_steps jsonb not null default '[]'::jsonb,
  commands jsonb not null default '[]'::jsonb,
  verification jsonb not null default '[]'::jsonb,
  rollback_plan jsonb not null default '[]'::jsonb,
  lessons_learned jsonb not null default '[]'::jsonb,
  related_components jsonb not null default '[]'::jsonb,
  related_knowledge_points jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  source text not null default 'json_import',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, case_id)
);

create index if not exists troubleshooting_custom_cases_user_updated_idx
  on public.troubleshooting_custom_cases (user_id, updated_at desc);

alter table public.troubleshooting_custom_cases enable row level security;

drop policy if exists "Users can view own troubleshooting cases"
  on public.troubleshooting_custom_cases;
create policy "Users can view own troubleshooting cases"
  on public.troubleshooting_custom_cases for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own troubleshooting cases"
  on public.troubleshooting_custom_cases;
create policy "Users can insert own troubleshooting cases"
  on public.troubleshooting_custom_cases for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own troubleshooting cases"
  on public.troubleshooting_custom_cases;
create policy "Users can update own troubleshooting cases"
  on public.troubleshooting_custom_cases for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own troubleshooting cases"
  on public.troubleshooting_custom_cases;
create policy "Users can delete own troubleshooting cases"
  on public.troubleshooting_custom_cases for delete
  using (auth.uid() = user_id);
