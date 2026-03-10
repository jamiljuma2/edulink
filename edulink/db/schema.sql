-- Edulink fresh database bootstrap
-- Safe to run on a new PostgreSQL / Neon database.
-- Uses IF NOT EXISTS so it can also be re-run for non-destructive setup.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id text primary key,
  email text,
  display_name text,
  role text not null check (role in ('student', 'writer', 'admin')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id text primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0,
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles(id) on delete cascade,
  type text not null check (type in ('topup', 'payment', 'payout', 'subscription')),
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  reference text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  student_id text references public.profiles(id) on delete cascade,
  writer_id text references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'submitted', 'completed', 'cancelled')),
  storage_path text,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  writer_id text references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('basic', 'standard', 'premium')),
  tasks_per_day integer not null,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  writer_id text references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'working', 'submitted', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  writer_id text references public.profiles(id) on delete cascade,
  storage_path text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.registration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.wallets add column if not exists updated_at timestamptz not null default now();
alter table public.transactions add column if not exists reference text;
alter table public.transactions add column if not exists meta jsonb;
alter table public.assignments add column if not exists writer_id text references public.profiles(id) on delete set null;
alter table public.assignments add column if not exists storage_path text;
alter table public.assignments add column if not exists due_date date;
alter table public.subscriptions add column if not exists starts_at timestamptz;
alter table public.subscriptions add column if not exists ends_at timestamptz;
alter table public.task_submissions add column if not exists notes text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_email_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_email_key;
  end if;
exception
  when undefined_table then
    null;
end
$$;

create unique index if not exists idx_profiles_email_lower_unique
  on public.profiles (lower(email))
  where email is not null;

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_approval_status on public.profiles (approval_status);
create index if not exists idx_profiles_last_seen_at on public.profiles (last_seen_at desc);
create index if not exists idx_profiles_created_at on public.profiles (created_at desc);

create index if not exists idx_wallets_updated_at on public.wallets (updated_at desc);

create index if not exists idx_transactions_user_id_created_at on public.transactions (user_id, created_at desc);
create index if not exists idx_transactions_reference on public.transactions (reference);
create index if not exists idx_transactions_type_created_at on public.transactions (type, created_at desc);
create index if not exists idx_transactions_status_created_at on public.transactions (status, created_at desc);
create index if not exists idx_transactions_created_at on public.transactions (created_at desc);

create index if not exists idx_assignments_student_id on public.assignments (student_id);
create index if not exists idx_assignments_writer_id on public.assignments (writer_id);
create index if not exists idx_assignments_status on public.assignments (status);
create index if not exists idx_assignments_created_at on public.assignments (created_at desc);
create index if not exists idx_assignments_student_status_created_at on public.assignments (student_id, status, created_at desc);

create index if not exists idx_subscriptions_writer_id on public.subscriptions (writer_id);
create index if not exists idx_subscriptions_writer_active on public.subscriptions (writer_id, active);
create index if not exists idx_subscriptions_active on public.subscriptions (active);

create index if not exists idx_tasks_assignment_id on public.tasks (assignment_id);
create index if not exists idx_tasks_writer_id on public.tasks (writer_id);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_writer_created_at on public.tasks (writer_id, created_at desc);

create index if not exists idx_task_submissions_task_id on public.task_submissions (task_id);
create index if not exists idx_task_submissions_writer_id on public.task_submissions (writer_id);
create index if not exists idx_task_submissions_status on public.task_submissions (status);
create index if not exists idx_task_submissions_created_at on public.task_submissions (created_at desc);

create index if not exists idx_registration_logs_user_id on public.registration_logs (user_id);
create index if not exists idx_registration_logs_action on public.registration_logs (action);
create index if not exists idx_registration_logs_created_at on public.registration_logs (created_at desc);
create index if not exists idx_registration_logs_user_id_action on public.registration_logs (user_id, action);

create or replace function public.ensure_assignment_student_link()
returns trigger
language plpgsql
as $$
begin
  if new.student_id is null then
    raise exception 'assignments.student_id cannot be null';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.student_id
      and p.role = 'student'
  ) then
    raise exception 'assignments.student_id % must reference an existing student profile', new.student_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assignments_student_link on public.assignments;

create trigger trg_assignments_student_link
before insert or update of student_id
on public.assignments
for each row
execute function public.ensure_assignment_student_link();

commit;

-- Optional reset for a completely disposable database:
-- drop schema public cascade;
-- create schema public;
