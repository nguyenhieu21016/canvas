-- Add post-session note column to salary_sessions (BTVN, nhận xét buổi học)
alter table public.salary_sessions
  add column if not exists note text not null default '';
