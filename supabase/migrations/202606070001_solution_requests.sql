create table if not exists public.solution_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  attempt_id uuid references public.attempts(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  requested_questions text not null check (length(trim(requested_questions)) > 0),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  solution_pdf_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index if not exists solution_requests_assignment_created_at_idx
on public.solution_requests(assignment_id, created_at desc);

create index if not exists solution_requests_student_created_at_idx
on public.solution_requests(student_id, created_at desc);

drop trigger if exists touch_solution_requests_updated_at on public.solution_requests;
create trigger touch_solution_requests_updated_at
before update on public.solution_requests
for each row execute function public.touch_updated_at();

alter table public.solution_requests enable row level security;

drop policy if exists "solution_requests select own manager" on public.solution_requests;
create policy "solution_requests select own manager"
on public.solution_requests for select
using (
  student_id = auth.uid()
  or public.can_manage_assignment(assignment_id)
);

drop policy if exists "solution_requests insert own visible assignment" on public.solution_requests;
create policy "solution_requests insert own visible assignment"
on public.solution_requests for insert
with check (
  student_id = auth.uid()
  and status = 'pending'
  and solution_pdf_url = ''
  and fulfilled_at is null
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and (a.published or public.can_manage_owner(a.owner_id))
  )
  and (
    attempt_id is null
    or exists (
      select 1
      from public.attempts at
      where at.id = attempt_id
        and at.assignment_id = assignment_id
        and at.student_id = auth.uid()
    )
  )
);

drop policy if exists "solution_requests update manager" on public.solution_requests;
create policy "solution_requests update manager"
on public.solution_requests for update
using (public.can_manage_assignment(assignment_id))
with check (public.can_manage_assignment(assignment_id));
