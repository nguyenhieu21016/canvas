-- salary_schedules: one record per student per month, stores rate
create table if not exists public.salary_schedules (
  id uuid primary key default gen_random_uuid(),
  month date not null, -- stores first day of month e.g. 2026-06-01
  student_id uuid not null references public.profiles(id) on delete cascade,
  rate_per_session numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint salary_schedules_student_month_unique unique (student_id, month)
);

alter table public.salary_schedules enable row level security;
grant select, insert, update, delete on public.salary_schedules to authenticated;

create policy "admin_manage_salary_schedules"
  on public.salary_schedules for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- salary_sessions: each taught session (date) for a schedule
create table if not exists public.salary_sessions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.salary_schedules(id) on delete cascade,
  session_date date not null,
  created_at timestamptz not null default now(),
  constraint salary_sessions_schedule_date_unique unique (schedule_id, session_date)
);

alter table public.salary_sessions enable row level security;
grant select, insert, update, delete on public.salary_sessions to authenticated;

create policy "admin_manage_salary_sessions"
  on public.salary_sessions for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
