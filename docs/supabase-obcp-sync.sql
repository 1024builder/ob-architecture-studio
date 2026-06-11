-- OB Architecture Studio v0.6.0
-- Run this script in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obcp_answer_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  question_id text not null,
  selected_answer jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null default '[]'::jsonb,
  is_correct boolean not null,
  duration_seconds integer not null default 0,
  answered_at timestamptz not null,
  chapter text not null,
  knowledge_points jsonb not null default '[]'::jsonb,
  difficulty text not null check (difficulty in ('基础', '进阶', '高级')),
  question_type text not null check (question_type in ('single', 'multiple', 'trueFalse')),
  is_favorite boolean not null default false,
  is_wrong_book boolean not null default false,
  retry_count integer not null default 0,
  is_not_understood boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create index if not exists obcp_answer_records_user_answered_at_idx
  on public.obcp_answer_records (user_id, answered_at desc);
create index if not exists obcp_answer_records_user_question_idx
  on public.obcp_answer_records (user_id, question_id);

create table if not exists public.obcp_question_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  is_favorite boolean not null default false,
  is_wrong_book boolean not null default false,
  is_not_understood boolean not null default false,
  retry_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.obcp_practice_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  mode text not null check (mode in ('sequential', 'random', 'exam', 'wrongBook', 'favorite')),
  source_label text not null,
  question_ids jsonb not null default '[]'::jsonb,
  answered_count integer not null default 0,
  correct_count integer not null default 0,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create index if not exists obcp_practice_sessions_user_completed_idx
  on public.obcp_practice_sessions (user_id, completed_at desc);

alter table public.profiles enable row level security;
alter table public.obcp_answer_records enable row level security;
alter table public.obcp_question_states enable row level security;
alter table public.obcp_practice_sessions enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users manage own answer records" on public.obcp_answer_records;
create policy "Users manage own answer records"
  on public.obcp_answer_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own question states" on public.obcp_question_states;
create policy "Users manage own question states"
  on public.obcp_question_states for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own practice sessions" on public.obcp_practice_sessions;
create policy "Users manage own practice sessions"
  on public.obcp_practice_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();
