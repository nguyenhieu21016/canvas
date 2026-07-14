-- Migration to add time_spent_ms and update RPCs

alter table public.attempt_answers 
add column if not exists time_spent_ms integer not null default 0;

-- Update get_attempt_review to return time_spent_ms
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
      'time_spent_ms', aa.time_spent_ms,
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

-- Update submit_assignment_attempt to accept p_time_spent
create or replace function public.submit_assignment_attempt(
  p_assignment_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_time_spent jsonb default '{}'::jsonb
)
returns public.attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts%rowtype;
  v_assignment public.assignments%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_assignment
  from public.assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  if not (v_assignment.published or public.can_manage_owner(v_assignment.owner_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  insert into public.attempts (assignment_id, student_id, status)
  values (p_assignment_id, v_user_id, 'draft')
  returning * into v_attempt;

  insert into public.attempt_answers (attempt_id, question_id, answer, time_spent_ms)
  select v_attempt.id, q.id, answer_item.answer, coalesce((p_time_spent->>answer_item.question_id::text)::integer, 0)
  from (
    select item.key::uuid as question_id, item.value as answer
    from jsonb_each(coalesce(p_answers, '{}'::jsonb)) as item
    where item.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) as answer_item
  join public.questions q
    on q.id = answer_item.question_id
   and q.assignment_id = p_assignment_id;

  return public.submit_attempt(v_attempt.id);
end;
$$;
