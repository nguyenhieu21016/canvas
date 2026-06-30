alter table public.phases
add column if not exists student_ids uuid[] default null;

drop policy if exists "phases select visible" on public.phases;
create policy "phases select visible"
on public.phases for select
using (
  (published or public.can_manage_owner(owner_id))
  and (
    student_ids is null 
    or array_length(student_ids, 1) is null
    or public.can_manage_owner(owner_id) 
    or auth.uid() = any(student_ids)
  )
);

create or replace function public.get_learning_path()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select auth.uid() as id, public.current_role() as role
  ),
  visible_phases as (
    select p.*
    from public.phases p
    where (p.published or public.can_manage_owner(p.owner_id))
      and (
        p.student_ids is null 
        or array_length(p.student_ids, 1) is null
        or public.can_manage_owner(p.owner_id) 
        or auth.uid() = any(p.student_ids)
      )
  ),
  visible_modules as (
    select m.*
    from public.modules m
    where m.published or public.can_manage_owner(m.owner_id)
  ),
  visible_lecture_groups as (
    select lg.*
    from public.lecture_groups lg
    where lg.published or public.can_manage_owner(lg.owner_id)
  ),
  visible_lectures as (
    select l.*
    from public.lectures l
    where l.published or public.can_manage_owner(l.owner_id)
  ),
  best_attempts as (
    select distinct on (a.assignment_id)
      a.assignment_id,
      a.score_10,
      a.submitted_at
    from public.attempts a
    where a.student_id = auth.uid()
      and a.status = 'submitted'::public.attempt_status
    order by a.assignment_id, a.score_10 desc nulls last, a.submitted_at desc nulls last
  ),
  visible_assignments as (
    select
      a.*,
      case
        when ba.assignment_id is null then
          jsonb_build_object('status', 'not_started', 'bestScore', null, 'submittedAt', null)
        else
          jsonb_build_object('status', 'submitted', 'bestScore', ba.score_10, 'submittedAt', ba.submitted_at)
      end as progress
    from public.assignments a
    left join best_attempts ba on ba.assignment_id = a.id
    where a.published or public.can_manage_owner(a.owner_id)
  )
  select jsonb_build_object(
    'phases', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.sort_order, item.created_at)
      from visible_phases item
    ), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.sort_order, item.created_at)
      from visible_modules item
    ), '[]'::jsonb),
    'lectureGroups', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.sort_order, item.created_at)
      from visible_lecture_groups item
    ), '[]'::jsonb),
    'lectures', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.sort_order, item.created_at)
      from visible_lectures item
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.sort_order, item.created_at)
      from visible_assignments item
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_learning_path() to authenticated;
