import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/202606010001_lms_schema.sql', 'utf8');

describe('Supabase migration', () => {
  it('defines core LMS tables', () => {
    for (const table of [
      'profiles',
      'phases',
      'modules',
      'lectures',
      'assignments',
      'questions',
      'answer_keys',
      'attempts',
      'attempt_answers',
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it('keeps grading and review in server-side RPCs', () => {
    expect(sql).toContain('create or replace function public.submit_attempt');
    expect(sql).toContain('create or replace function public.get_attempt_review');
  });

  it('enables row level security on answer keys', () => {
    expect(sql).toContain('alter table public.answer_keys enable row level security');
    expect(sql).toContain('answer_keys select owner admin');
  });

  it('scopes attempt visibility and submission through review policies', () => {
    expect(sql).toContain('create or replace function public.can_review_attempt');
    expect(sql).toContain('using (public.can_review_attempt(id))');
    expect(sql).toContain('using (public.can_review_attempt(attempt_id))');
    expect(sql).toContain("and (a.published or public.can_manage_owner(a.owner_id))");
    expect(sql).toContain('if v_attempt.student_id <> auth.uid() then');
  });

  it('provides a database fallback for admin-managed account creation', () => {
    expect(sql).toContain('create or replace function public.admin_create_user_sql');
    expect(sql).toContain('Teachers can only create students');
    expect(sql).toContain('insert into auth.users');
    expect(sql).toContain('grant execute on function public.admin_create_user_sql');
  });
});
