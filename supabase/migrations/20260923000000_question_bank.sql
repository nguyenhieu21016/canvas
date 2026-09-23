-- 1. Alter public.questions to make assignment_id nullable
ALTER TABLE public.questions ALTER COLUMN assignment_id DROP NOT NULL;

-- 2. Add owner_id to track who owns the bank question (default to auth.uid())
ALTER TABLE public.questions ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid();

-- For existing questions, owner_id could be copied from assignments.owner_id
UPDATE public.questions q
SET owner_id = a.owner_id
FROM public.assignments a
WHERE q.assignment_id = a.id;

-- 3. Add is_bank_question boolean
ALTER TABLE public.questions ADD COLUMN is_bank_question boolean NOT NULL DEFAULT false;

-- 4. Add tags array
ALTER TABLE public.questions ADD COLUMN tags text[] NOT NULL DEFAULT '{}';

-- 5. Update RLS policies for questions

-- Drop existing policies
DROP POLICY IF EXISTS "questions select visible assignment" ON public.questions;
DROP POLICY IF EXISTS "questions insert owner admin" ON public.questions;
DROP POLICY IF EXISTS "questions update owner admin" ON public.questions;
DROP POLICY IF EXISTS "questions delete owner admin" ON public.questions;

CREATE POLICY "questions select visible"
ON public.questions FOR SELECT
USING (
  (is_bank_question = true AND public.is_manager())
  OR (
    assignment_id IS NOT NULL AND exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and (a.published or public.can_manage_owner(a.owner_id))
    )
  )
);

CREATE POLICY "questions insert owner admin"
ON public.questions FOR INSERT
WITH CHECK (
  (assignment_id IS NOT NULL AND public.can_manage_assignment(assignment_id))
  OR (is_bank_question = true AND public.is_manager())
);

CREATE POLICY "questions update owner admin"
ON public.questions FOR UPDATE
USING (
  (assignment_id IS NOT NULL AND public.can_manage_assignment(assignment_id))
  OR (is_bank_question = true AND public.can_manage_owner(owner_id))
)
WITH CHECK (
  (assignment_id IS NOT NULL AND public.can_manage_assignment(assignment_id))
  OR (is_bank_question = true AND public.can_manage_owner(owner_id))
);

CREATE POLICY "questions delete owner admin"
ON public.questions FOR DELETE
USING (
  (assignment_id IS NOT NULL AND public.can_manage_assignment(assignment_id))
  OR (is_bank_question = true AND public.can_manage_owner(owner_id))
);

-- We also need to update answer_keys RLS because they check assignment ownership.
DROP POLICY IF EXISTS "answer_keys select owner admin" ON public.answer_keys;
DROP POLICY IF EXISTS "answer_keys write owner admin" ON public.answer_keys;

CREATE POLICY "answer_keys select owner admin"
ON public.answer_keys FOR SELECT
USING (
  exists (
    select 1
    from public.questions q
    where q.id = question_id
      and (
        (q.is_bank_question = true AND public.is_manager())
        or (
          q.assignment_id IS NOT NULL AND exists (
            select 1 from public.assignments a
            where a.id = q.assignment_id and public.can_manage_owner(a.owner_id)
          )
        )
      )
  )
);

CREATE POLICY "answer_keys write owner admin"
ON public.answer_keys FOR ALL
USING (
  exists (
    select 1
    from public.questions q
    where q.id = question_id
      and (
        (q.is_bank_question = true AND public.can_manage_owner(q.owner_id))
        or (
          q.assignment_id IS NOT NULL AND exists (
            select 1 from public.assignments a
            where a.id = q.assignment_id and public.can_manage_owner(a.owner_id)
          )
        )
      )
  )
)
WITH CHECK (
  exists (
    select 1
    from public.questions q
    where q.id = question_id
      and (
        (q.is_bank_question = true AND public.can_manage_owner(q.owner_id))
        or (
          q.assignment_id IS NOT NULL AND exists (
            select 1 from public.assignments a
            where a.id = q.assignment_id and public.can_manage_owner(a.owner_id)
          )
        )
      )
  )
);
