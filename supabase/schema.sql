-- Profiles table to store user roles and approval status
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  role text check (role in ('student','writer','admin')) not null,
  approval_status text check (approval_status in ('pending','approved','rejected')) default 'pending' not null,
  created_at timestamp with time zone default now()
);

-- Wallets and transactions
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) default 0 not null,
  currency text default 'USD' not null,
  updated_at timestamp with time zone default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text check (type in ('topup','payment','payout','subscription')) not null,
  amount numeric(12,2) not null,
  currency text default 'USD' not null,
  status text check (status in ('pending','success','failed')) default 'pending' not null,
  reference text,
  meta jsonb,
  created_at timestamp with time zone default now()
);

-- Assignments and uploads
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  writer_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text check (status in ('open','in_progress','submitted','completed','cancelled')) default 'open' not null,
  storage_path text, -- Supabase storage path for file
  due_date date,
  created_at timestamp with time zone default now()
);

-- Writer subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  writer_id uuid references public.profiles(id) on delete cascade,
  plan text check (plan in ('basic','standard','premium')) not null,
  tasks_per_day int not null,
  active boolean default false,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
);

-- Tasks handled by writers (per-day limit enforcement)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  writer_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('accepted','working','submitted','approved','rejected')) default 'accepted' not null,
  created_at timestamp with time zone default now()
);

-- Task submissions (writer uploads)
create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  writer_id uuid references public.profiles(id) on delete cascade,
  storage_path text not null,
  notes text,
  status text check (status in ('pending','approved','rejected')) default 'pending' not null,
  created_at timestamp with time zone default now()
);

-- Storage bucket for assignments
-- Create via UI: storage bucket name 'assignments'
-- Policies: allow user upload/read their own files
-- Example RLS (adjust to your org needs):
-- Enable RLS
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.assignments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;

-- Profiles policy: users can read their own profile; admins read all
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
-- Admin role check requires JWT with role claim; alternatively manage via RPC or service key on server routes

-- Wallets policy: user can read/update their own wallet
create policy "read own wallet" on public.wallets for select using (auth.uid() = user_id);
create policy "update own wallet" on public.wallets for update using (auth.uid() = user_id);

-- Transactions policy: user can insert/read their own transactions
create policy "insert own transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "read own transactions" on public.transactions for select using (auth.uid() = user_id);

-- Assignments policy: student can manage own assignments; writer read open
create policy "student manages own assignments" on public.assignments for all using (auth.uid() = student_id);
create policy "writer reads open assignments" on public.assignments for select using (true);
create policy "writer claim open assignment" on public.assignments
  for update using (status = 'open' and writer_id is null)
  with check (writer_id = auth.uid());
create policy "writer updates assigned assignments" on public.assignments
  for update using (auth.uid() = writer_id)
  with check (writer_id = auth.uid());

-- Subscriptions policy: writer manages own
create policy "writer manages own subscriptions" on public.subscriptions for all using (auth.uid() = writer_id);

-- Tasks policy: writer manages own tasks
create policy "writer manages own tasks" on public.tasks for all using (auth.uid() = writer_id);

-- Task submissions: writer manages own submissions
create policy "writer manages own submissions" on public.task_submissions
  for all using (auth.uid() = writer_id);

-- Storage policies (Supabase storage schema)
-- Allow users to upload and read only within their own folder in assignments bucket
-- Note: run these in the SQL editor after creating the bucket
create policy "upload own assignment files" on storage.objects
  for insert with check (
    bucket_id = 'assignments' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own assignment files" on storage.objects
  for select using (
    bucket_id = 'assignments' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for submissions bucket
create policy "upload own submission files" on storage.objects
  for insert with check (
    bucket_id = 'submissions' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own submission files" on storage.objects
  for select using (
    bucket_id = 'submissions' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Helpful indexes for scaling
create index if not exists idx_profiles_approval_status on public.profiles (approval_status);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_transactions_created_at on public.transactions (created_at desc);
create index if not exists idx_transactions_type_created_at on public.transactions (type, created_at desc);
create index if not exists idx_tasks_writer_id on public.tasks (writer_id);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_task_submissions_created_at on public.task_submissions (created_at desc);
create index if not exists idx_assignments_status on public.assignments (status);
create index if not exists idx_assignments_student_id on public.assignments (student_id);
create index if not exists idx_assignments_writer_id on public.assignments (writer_id);
