-- OB Architecture Studio v0.7.0
-- Run this script in the Supabase SQL editor after the existing OBCP sync SQL.

create table if not exists public.obcp_custom_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  chapter text not null,
  knowledge_points jsonb not null default '[]'::jsonb,
  type text not null check (type in ('single', 'multiple', 'trueFalse', 'judge')),
  stem text not null,
  options jsonb not null default '[]'::jsonb,
  answer jsonb not null default '[]'::jsonb,
  explanation text not null,
  tags jsonb not null default '[]'::jsonb,
  difficulty text not null check (difficulty in ('基础', '进阶', '高级')),
  related_components jsonb not null default '[]'::jsonb,
  common_mistakes jsonb not null default '[]'::jsonb,
  review_suggestion text not null,
  exam_point text not null,
  source text not null default 'json_import',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists obcp_custom_questions_user_updated_idx
  on public.obcp_custom_questions (user_id, updated_at desc);

alter table public.obcp_custom_questions enable row level security;

drop policy if exists "Users can view own custom questions"
  on public.obcp_custom_questions;
create policy "Users can view own custom questions"
  on public.obcp_custom_questions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own custom questions"
  on public.obcp_custom_questions;
create policy "Users can insert own custom questions"
  on public.obcp_custom_questions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own custom questions"
  on public.obcp_custom_questions;
create policy "Users can update own custom questions"
  on public.obcp_custom_questions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own custom questions"
  on public.obcp_custom_questions;
create policy "Users can delete own custom questions"
  on public.obcp_custom_questions for delete
  using (auth.uid() = user_id);
