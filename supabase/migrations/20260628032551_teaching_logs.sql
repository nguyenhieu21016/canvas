-- teaching_logs: tracks which lectures a teacher has taught to each student
create table if not exists public.teaching_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  taught_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  constraint teaching_logs_student_lecture_unique unique (student_id, lecture_id)
);

alter table public.teaching_logs enable row level security;

-- Grant table access to authenticated role
grant select, insert, update, delete on public.teaching_logs to authenticated;

-- Teachers (role = teacher or admin) can manage all teaching logs
create policy "teachers_manage_teaching_logs"
  on public.teaching_logs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and role in ('teacher', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and role in ('teacher', 'admin')
    )
  );

-- Students can read their own teaching logs
create policy "students_read_own_teaching_logs"
  on public.teaching_logs
  for select
  to authenticated
  using (student_id = (select auth.uid()));
