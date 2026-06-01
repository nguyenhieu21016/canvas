create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('student', 'teacher', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type public.question_type as enum ('mcq', 'tf4', 'short');
  end if;
  if not exists (select 1 from pg_type where typname = 'attempt_status') then
    create type public.attempt_status as enum ('draft', 'submitted');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.app_role not null default 'student',
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lecture_groups (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  group_id uuid references public.lecture_groups(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  slide_url text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lectures
add column if not exists group_id uuid references public.lecture_groups(id) on delete set null;

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid references public.lectures(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  pdf_url text not null,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  type public.question_type not null,
  prompt text not null,
  points numeric(8, 3) not null default 1 check (points >= 0),
  sort_order integer not null default 0,
  choices jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_answer jsonb,
  accepted_answers text[] not null default '{}',
  points_map jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  status public.attempt_status not null default 'draft',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(10, 4),
  max_points numeric(10, 4),
  score_10 numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempt_answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer jsonb not null default 'null'::jsonb,
  is_correct boolean,
  earned_points numeric(10, 4) not null default 0,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index if not exists modules_phase_id_idx on public.modules(phase_id);
create index if not exists lecture_groups_module_id_idx on public.lecture_groups(module_id);
create index if not exists lectures_module_id_idx on public.lectures(module_id);
create index if not exists lectures_group_id_idx on public.lectures(group_id);
create index if not exists assignments_lecture_id_idx on public.assignments(lecture_id);
create index if not exists questions_assignment_id_idx on public.questions(assignment_id);
create index if not exists attempts_student_id_idx on public.attempts(student_id);
create index if not exists attempts_assignment_id_idx on public.attempts(assignment_id);
create index if not exists profiles_role_created_at_idx on public.profiles(role, created_at desc);
create index if not exists phases_published_sort_idx on public.phases(published, sort_order, created_at);
create index if not exists modules_published_phase_sort_idx on public.modules(published, phase_id, sort_order, created_at);
create index if not exists lecture_groups_published_module_sort_idx on public.lecture_groups(published, module_id, sort_order, created_at);
create index if not exists lectures_published_module_sort_idx on public.lectures(published, module_id, sort_order, created_at);
create index if not exists lectures_published_group_sort_idx on public.lectures(published, group_id, sort_order, created_at);
create index if not exists assignments_published_lecture_sort_idx on public.assignments(published, lecture_id, sort_order, created_at);
create index if not exists assignments_owner_created_at_idx on public.assignments(owner_id, created_at desc);
create index if not exists questions_assignment_sort_idx on public.questions(assignment_id, sort_order, created_at);
create index if not exists attempts_status_submitted_at_idx on public.attempts(status, submitted_at desc);
create index if not exists attempts_student_status_submitted_at_idx on public.attempts(student_id, status, submitted_at desc);
create index if not exists attempts_assignment_status_submitted_at_idx on public.attempts(assignment_id, status, submitted_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_phases_updated_at on public.phases;
create trigger touch_phases_updated_at
before update on public.phases
for each row execute function public.touch_updated_at();

drop trigger if exists touch_modules_updated_at on public.modules;
create trigger touch_modules_updated_at
before update on public.modules
for each row execute function public.touch_updated_at();

drop trigger if exists touch_lecture_groups_updated_at on public.lecture_groups;
create trigger touch_lecture_groups_updated_at
before update on public.lecture_groups
for each row execute function public.touch_updated_at();

drop trigger if exists touch_lectures_updated_at on public.lectures;
create trigger touch_lectures_updated_at
before update on public.lectures
for each row execute function public.touch_updated_at();

drop trigger if exists touch_assignments_updated_at on public.assignments;
create trigger touch_assignments_updated_at
before update on public.assignments
for each row execute function public.touch_updated_at();

drop trigger if exists touch_questions_updated_at on public.questions;
create trigger touch_questions_updated_at
before update on public.questions
for each row execute function public.touch_updated_at();

drop trigger if exists touch_answer_keys_updated_at on public.answer_keys;
create trigger touch_answer_keys_updated_at
before update on public.answer_keys
for each row execute function public.touch_updated_at();

drop trigger if exists touch_attempts_updated_at on public.attempts;
create trigger touch_attempts_updated_at
before update on public.attempts
for each row execute function public.touch_updated_at();

drop trigger if exists touch_attempt_answers_updated_at on public.attempt_answers;
create trigger touch_attempt_answers_updated_at
before update on public.attempt_answers
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'admin'::public.app_role
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('teacher'::public.app_role, 'admin'::public.app_role)
$$;

create or replace function public.can_manage_owner(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or (public.current_role() = 'teacher'::public.app_role and p_owner_id = auth.uid())
$$;

create or replace function public.can_manage_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = p_assignment_id
      and public.can_manage_owner(a.owner_id)
  )
$$;

create or replace function public.can_review_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attempts at
    join public.assignments a on a.id = at.assignment_id
    where at.id = p_attempt_id
      and (
        at.student_id = auth.uid()
        or public.is_admin()
        or (public.current_role() = 'teacher'::public.app_role and a.owner_id = auth.uid())
      )
  )
$$;

alter table public.profiles enable row level security;
alter table public.phases enable row level security;
alter table public.modules enable row level security;
alter table public.lecture_groups enable row level security;
alter table public.lectures enable row level security;
alter table public.assignments enable row level security;
alter table public.questions enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

drop policy if exists "profiles select self manager" on public.profiles;
create policy "profiles select self manager"
on public.profiles for select
using (
  id = auth.uid()
  or public.is_admin()
  or (public.current_role() = 'teacher'::public.app_role and role = 'student'::public.app_role)
);

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles update self name" on public.profiles;
create policy "profiles update self name"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_role());

drop policy if exists "phases select visible" on public.phases;
create policy "phases select visible"
on public.phases for select
using (published or public.can_manage_owner(owner_id));

drop policy if exists "phases insert manager" on public.phases;
create policy "phases insert manager"
on public.phases for insert
with check (public.is_manager() and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists "phases update owner admin" on public.phases;
create policy "phases update owner admin"
on public.phases for update
using (public.can_manage_owner(owner_id))
with check (public.can_manage_owner(owner_id));

drop policy if exists "phases delete owner admin" on public.phases;
create policy "phases delete owner admin"
on public.phases for delete
using (public.can_manage_owner(owner_id));

drop policy if exists "modules select visible" on public.modules;
create policy "modules select visible"
on public.modules for select
using (published or public.can_manage_owner(owner_id));

drop policy if exists "modules insert manager" on public.modules;
create policy "modules insert manager"
on public.modules for insert
with check (public.is_manager() and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists "modules update owner admin" on public.modules;
create policy "modules update owner admin"
on public.modules for update
using (public.can_manage_owner(owner_id))
with check (public.can_manage_owner(owner_id));

drop policy if exists "modules delete owner admin" on public.modules;
create policy "modules delete owner admin"
on public.modules for delete
using (public.can_manage_owner(owner_id));

drop policy if exists "lecture_groups select visible" on public.lecture_groups;
create policy "lecture_groups select visible"
on public.lecture_groups for select
using (published or public.can_manage_owner(owner_id));

drop policy if exists "lecture_groups insert manager" on public.lecture_groups;
create policy "lecture_groups insert manager"
on public.lecture_groups for insert
with check (public.is_manager() and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists "lecture_groups update owner admin" on public.lecture_groups;
create policy "lecture_groups update owner admin"
on public.lecture_groups for update
using (public.can_manage_owner(owner_id))
with check (public.can_manage_owner(owner_id));

drop policy if exists "lecture_groups delete owner admin" on public.lecture_groups;
create policy "lecture_groups delete owner admin"
on public.lecture_groups for delete
using (public.can_manage_owner(owner_id));

drop policy if exists "lectures select visible" on public.lectures;
create policy "lectures select visible"
on public.lectures for select
using (published or public.can_manage_owner(owner_id));

drop policy if exists "lectures insert manager" on public.lectures;
create policy "lectures insert manager"
on public.lectures for insert
with check (public.is_manager() and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists "lectures update owner admin" on public.lectures;
create policy "lectures update owner admin"
on public.lectures for update
using (public.can_manage_owner(owner_id))
with check (public.can_manage_owner(owner_id));

drop policy if exists "lectures delete owner admin" on public.lectures;
create policy "lectures delete owner admin"
on public.lectures for delete
using (public.can_manage_owner(owner_id));

drop policy if exists "assignments select visible" on public.assignments;
create policy "assignments select visible"
on public.assignments for select
using (published or public.can_manage_owner(owner_id));

drop policy if exists "assignments insert manager" on public.assignments;
create policy "assignments insert manager"
on public.assignments for insert
with check (public.is_manager() and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists "assignments update owner admin" on public.assignments;
create policy "assignments update owner admin"
on public.assignments for update
using (public.can_manage_owner(owner_id))
with check (public.can_manage_owner(owner_id));

drop policy if exists "assignments delete owner admin" on public.assignments;
create policy "assignments delete owner admin"
on public.assignments for delete
using (public.can_manage_owner(owner_id));

drop policy if exists "questions select visible assignment" on public.questions;
create policy "questions select visible assignment"
on public.questions for select
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and (a.published or public.can_manage_owner(a.owner_id))
  )
);

drop policy if exists "questions insert owner admin" on public.questions;
create policy "questions insert owner admin"
on public.questions for insert
with check (public.can_manage_assignment(assignment_id));

drop policy if exists "questions update owner admin" on public.questions;
create policy "questions update owner admin"
on public.questions for update
using (public.can_manage_assignment(assignment_id))
with check (public.can_manage_assignment(assignment_id));

drop policy if exists "questions delete owner admin" on public.questions;
create policy "questions delete owner admin"
on public.questions for delete
using (public.can_manage_assignment(assignment_id));

drop policy if exists "answer_keys select owner admin" on public.answer_keys;
create policy "answer_keys select owner admin"
on public.answer_keys for select
using (
  exists (
    select 1
    from public.questions q
    join public.assignments a on a.id = q.assignment_id
    where q.id = question_id
      and public.can_manage_owner(a.owner_id)
  )
);

drop policy if exists "answer_keys write owner admin" on public.answer_keys;
create policy "answer_keys write owner admin"
on public.answer_keys for all
using (
  exists (
    select 1
    from public.questions q
    join public.assignments a on a.id = q.assignment_id
    where q.id = question_id
      and public.can_manage_owner(a.owner_id)
  )
)
with check (
  exists (
    select 1
    from public.questions q
    join public.assignments a on a.id = q.assignment_id
    where q.id = question_id
      and public.can_manage_owner(a.owner_id)
  )
);

drop policy if exists "attempts select own manager" on public.attempts;
create policy "attempts select own manager"
on public.attempts for select
using (public.can_review_attempt(id));

drop policy if exists "attempts insert own draft" on public.attempts;
create policy "attempts insert own draft"
on public.attempts for insert
with check (
  student_id = auth.uid()
  and status = 'draft'
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and (a.published or public.can_manage_owner(a.owner_id))
  )
);

drop policy if exists "attempts update own draft" on public.attempts;

drop policy if exists "attempt_answers select own manager" on public.attempt_answers;
create policy "attempt_answers select own manager"
on public.attempt_answers for select
using (public.can_review_attempt(attempt_id));

drop policy if exists "attempt_answers insert own draft" on public.attempt_answers;
create policy "attempt_answers insert own draft"
on public.attempt_answers for insert
with check (
  exists (
    select 1
    from public.attempts at
    where at.id = attempt_id
      and at.student_id = auth.uid()
      and at.status = 'draft'
      and exists (
        select 1
        from public.questions q
        where q.id = question_id
          and q.assignment_id = at.assignment_id
      )
  )
);

drop policy if exists "attempt_answers update own draft" on public.attempt_answers;

create or replace function public.normalize_answer_text(p_value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.submit_attempt(p_attempt_id uuid)
returns public.attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_item record;
  v_index integer;
  v_earned numeric := 0;
  v_max numeric := 0;
  v_item_earned numeric;
  v_item_point numeric;
  v_is_correct boolean;
  v_actual text;
  v_expected text;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.student_id <> auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_attempt.status <> 'draft' then
    raise exception 'Attempt already submitted' using errcode = '23514';
  end if;

  for v_item in
    select
      q.id as question_id,
      q.type,
      q.points,
      coalesce(aa.answer, 'null'::jsonb) as answer,
      ak.correct_answer,
      ak.accepted_answers,
      ak.points_map
    from public.questions q
    left join public.answer_keys ak on ak.question_id = q.id
    left join public.attempt_answers aa
      on aa.question_id = q.id and aa.attempt_id = p_attempt_id
    where q.assignment_id = v_attempt.assignment_id
    order by q.sort_order, q.created_at
  loop
    v_item_earned := 0;
    v_is_correct := false;
    v_max := v_max + v_item.points;

    if v_item.type = 'mcq' then
      v_actual := upper(trim(coalesce(v_item.answer #>> '{}', '')));
      v_expected := upper(trim(coalesce(v_item.correct_answer #>> '{}', '')));
      v_is_correct := v_actual <> '' and v_actual = v_expected;
      if v_is_correct then
        v_item_earned := v_item.points;
      end if;
    elsif v_item.type = 'tf4' then
      for v_index in 0..3 loop
        if v_item.correct_answer ->> v_index is not null then
          v_item_point := coalesce(nullif(v_item.points_map ->> v_index, '')::numeric, v_item.points / 4);
          if v_item.answer ->> v_index is not null
            and (v_item.answer ->> v_index)::boolean = (v_item.correct_answer ->> v_index)::boolean then
            v_item_earned := v_item_earned + v_item_point;
          end if;
        end if;
      end loop;
      v_is_correct := v_item_earned = v_item.points;
    elsif v_item.type = 'short' then
      v_actual := public.normalize_answer_text(v_item.answer #>> '{}');
      select exists (
        select 1
        from unnest(coalesce(v_item.accepted_answers, '{}')) as accepted(answer)
        where public.normalize_answer_text(accepted.answer) = v_actual
          and v_actual <> ''
      ) into v_is_correct;
      if v_is_correct then
        v_item_earned := v_item.points;
      end if;
    end if;

    v_earned := v_earned + v_item_earned;

    insert into public.attempt_answers (
      attempt_id,
      question_id,
      answer,
      is_correct,
      earned_points
    )
    values (
      p_attempt_id,
      v_item.question_id,
      v_item.answer,
      v_is_correct,
      v_item_earned
    )
    on conflict (attempt_id, question_id) do update
    set is_correct = excluded.is_correct,
        earned_points = excluded.earned_points,
        updated_at = now();
  end loop;

  update public.attempts
  set status = 'submitted',
      submitted_at = now(),
      score = v_earned,
      max_points = v_max,
      score_10 = case when v_max > 0 then round((v_earned / v_max) * 10, 2) else 0 end,
      updated_at = now()
  where id = p_attempt_id
  returning * into v_attempt;

  return v_attempt;
end;
$$;

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_assignment jsonb;
  v_items jsonb;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'submitted' or not public.can_review_attempt(p_attempt_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select to_jsonb(a) into v_assignment
  from public.assignments a
  where a.id = v_attempt.assignment_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'question_id', q.id,
      'type', q.type,
      'prompt', q.prompt,
      'points', q.points,
      'answer', aa.answer,
      'is_correct', aa.is_correct,
      'earned_points', aa.earned_points,
      'correct_answer', ak.correct_answer,
      'accepted_answers', ak.accepted_answers
    )
    order by q.sort_order, q.created_at
  ), '[]'::jsonb)
  into v_items
  from public.questions q
  left join public.attempt_answers aa
    on aa.question_id = q.id and aa.attempt_id = p_attempt_id
  left join public.answer_keys ak on ak.question_id = q.id
  where q.assignment_id = v_attempt.assignment_id;

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt),
    'assignment', v_assignment,
    'items', v_items
  );
end;
$$;

create or replace function public.get_dashboard_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with actor as (
    select id, role
    from public.profiles
    where id = auth.uid()
      and status = 'active'
      and role in ('teacher'::public.app_role, 'admin'::public.app_role)
  ),
  visible_assignments as (
    select a.id
    from public.assignments a
    cross join actor
    where actor.role = 'admin'::public.app_role
      or a.owner_id = actor.id
  ),
  submitted_attempts as (
    select at.score_10
    from public.attempts at
    join visible_assignments va on va.id = at.assignment_id
    where at.status = 'submitted'::public.attempt_status
  )
  select jsonb_build_object(
    'total_students', (
      select count(*)
      from public.profiles p
      cross join actor
      where p.role = 'student'::public.app_role
    ),
    'total_assignments', (select count(*) from visible_assignments),
    'total_submissions', (select count(*) from submitted_attempts),
    'average_score', coalesce((select round(avg(score_10)::numeric, 2) from submitted_attempts), 0)
  );
$$;

create or replace function public.admin_create_user_sql(
  p_email text,
  p_password text,
  p_full_name text,
  p_role public.app_role default 'student'::public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_actor_role public.app_role;
  v_user_id uuid;
  v_profile public.profiles%rowtype;
begin
  select role into v_actor_role
  from public.profiles
  where id = auth.uid()
    and status = 'active';

  if v_actor_role is null or v_actor_role not in ('teacher'::public.app_role, 'admin'::public.app_role) then
    raise exception 'Manager role required' using errcode = '42501';
  end if;

  if v_actor_role = 'teacher'::public.app_role and p_role <> 'student'::public.app_role then
    raise exception 'Teachers can only create students' using errcode = '42501';
  end if;

  if coalesce(trim(p_email), '') = '' or coalesce(p_password, '') = '' then
    raise exception 'Email and password are required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(p_email))
      and deleted_at is null
  ) then
    raise exception 'Email already exists' using errcode = '23505';
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    is_super_admin,
    is_sso_user,
    is_anonymous
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', coalesce(p_full_name, '')),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false,
    false
  )
  returning id into v_user_id;

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(trim(p_email)),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, email, full_name, role, status)
  values (v_user_id, lower(trim(p_email)), coalesce(p_full_name, ''), p_role, 'active')
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      status = 'active',
      updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.admin_delete_user_sql(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_role public.app_role;
  v_target_role public.app_role;
begin
  select role into v_actor_role
  from public.profiles
  where id = auth.uid()
    and status = 'active';

  if v_actor_role is null or v_actor_role not in ('teacher'::public.app_role, 'admin'::public.app_role) then
    raise exception 'Manager role required' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own account' using errcode = '42501';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_user_id;

  if v_target_role is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if v_target_role <> 'student'::public.app_role then
    raise exception 'Only student accounts can be deleted here' using errcode = '42501';
  end if;

  delete from auth.users
  where id = p_user_id;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.phases to authenticated;
grant select, insert, update, delete on public.modules to authenticated;
grant select, insert, update, delete on public.lecture_groups to authenticated;
grant select, insert, update, delete on public.lectures to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.answer_keys to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;
grant select, insert, update, delete on public.attempt_answers to authenticated;
grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.admin_create_user_sql(text, text, text, public.app_role) to authenticated;
grant execute on function public.admin_delete_user_sql(uuid) to authenticated;

-- Seed admin flow:
-- 1. Create the first admin user in Supabase Auth Dashboard.
-- 2. Run: update public.profiles set role = 'admin' where email = 'admin@example.com';
