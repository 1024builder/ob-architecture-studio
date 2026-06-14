-- OB Architecture Studio v1.4.0
-- Run this script in the Supabase SQL editor.

create table if not exists public.tax_question_banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_id text not null,
  bank_name text not null,
  exam text not null default '税务师',
  subject text not null,
  source text not null,
  year integer not null,
  question_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bank_id)
);

create table if not exists public.tax_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_id text not null,
  question_id text not null,
  subject text not null,
  chapter text not null,
  section text not null,
  type text not null check (type in ('single', 'multiple', 'judge', 'calculation', 'comprehensive', 'short_answer')),
  stem text not null,
  options jsonb not null default '[]'::jsonb,
  answer jsonb not null default '[]'::jsonb,
  explanation text not null,
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard')),
  tags jsonb not null default '[]'::jsonb,
  note text not null default '',
  source_text text,
  year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bank_id, question_id)
);

create table if not exists public.tax_answer_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  question_id text not null,
  bank_id text not null,
  subject text not null,
  chapter text not null,
  type text not null,
  user_answer jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null default '[]'::jsonb,
  is_correct boolean,
  duration_seconds integer not null default 0,
  practice_mode text not null default 'sequential',
  answered_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_id)
);

create table if not exists public.tax_question_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  bank_id text not null,
  subject text not null,
  chapter text not null,
  is_favorite boolean not null default false,
  is_wrong boolean not null default false,
  is_confused boolean not null default false,
  wrong_count integer not null default 0,
  last_answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bank_id, question_id)
);

create index if not exists tax_question_banks_user_updated_idx
  on public.tax_question_banks (user_id, updated_at desc);
create index if not exists tax_questions_user_bank_idx
  on public.tax_questions (user_id, bank_id);
create index if not exists tax_answer_records_user_answered_idx
  on public.tax_answer_records (user_id, answered_at desc);
create index if not exists tax_question_states_user_updated_idx
  on public.tax_question_states (user_id, updated_at desc);

alter table public.tax_question_banks enable row level security;
alter table public.tax_questions enable row level security;
alter table public.tax_answer_records enable row level security;
alter table public.tax_question_states enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tax_question_banks',
    'tax_questions',
    'tax_answer_records',
    'tax_question_states'
  ]
  loop
    execute format('drop policy if exists "Users can view own %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Users can view own %s" on public.%I for select using (auth.uid() = user_id)',
      table_name,
      table_name
    );
    execute format('drop policy if exists "Users can insert own %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Users can insert own %s" on public.%I for insert with check (auth.uid() = user_id)',
      table_name,
      table_name
    );
    execute format('drop policy if exists "Users can update own %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Users can update own %s" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name,
      table_name
    );
    execute format('drop policy if exists "Users can delete own %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Users can delete own %s" on public.%I for delete using (auth.uid() = user_id)',
      table_name,
      table_name
    );
  end loop;
end $$;
