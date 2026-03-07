-- Project schema for external PostgreSQL
create table if not exists public.profiles (
  id text primary key,
  email text unique,
  display_name text,
  role text check (role in ('student','writer','admin')) not null,
  approval_status text check (approval_status in ('pending','approved','rejected')) default 'pending' not null,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table public.profiles add column if not exists last_seen_at timestamp with time zone;

create table if not exists public.wallets (
  user_id text primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) default 0 not null,
  currency text default 'USD' not null,
  updated_at timestamp with time zone default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles(id) on delete cascade,
  type text check (type in ('topup','payment','payout','subscription')) not null,
  amount numeric(12,2) not null,
  currency text default 'USD' not null,
  status text check (status in ('pending','success','failed')) default 'pending' not null,
  reference text,
  meta jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  student_id text references public.profiles(id) on delete cascade,
  writer_id text references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text check (status in ('open','in_progress','submitted','completed','cancelled')) default 'open' not null,
  storage_path text,
  due_date date,
  created_at timestamp with time zone default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  writer_id text references public.profiles(id) on delete cascade,
  plan text check (plan in ('basic','standard','premium')) not null,
  tasks_per_day int not null,
  active boolean default false,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  writer_id text references public.profiles(id) on delete cascade,
  status text check (status in ('accepted','working','submitted','approved','rejected')) default 'accepted' not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  writer_id text references public.profiles(id) on delete cascade,
  storage_path text not null,
  notes text,
  status text check (status in ('pending','approved','rejected')) default 'pending' not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.registration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_profiles_approval_status on public.profiles (approval_status);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_last_seen_at on public.profiles (last_seen_at desc);
create index if not exists idx_transactions_created_at on public.transactions (created_at desc);
create index if not exists idx_transactions_type_created_at on public.transactions (type, created_at desc);
create index if not exists idx_tasks_writer_id on public.tasks (writer_id);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_task_submissions_created_at on public.task_submissions (created_at desc);
create index if not exists idx_assignments_status on public.assignments (status);
create index if not exists idx_assignments_student_id on public.assignments (student_id);
create index if not exists idx_assignments_writer_id on public.assignments (writer_id);

create index if not exists idx_registration_logs_user_id on public.registration_logs (user_id);
create index if not exists idx_registration_logs_created_at on public.registration_logs (created_at desc);
create index if not exists idx_registration_logs_action on public.registration_logs (action);
create index if not exists idx_registration_logs_user_id_action on public.registration_logs (user_id, action);

-- Optional extension cleanup
-- drop extension if exists pg_cron cascade;
-- drop extension if exists pg_graphql cascade;
