-- Add 'taught' boolean to salary_sessions
-- false = scheduled (có lịch), true = taught (đã dạy)
alter table public.salary_sessions
  add column if not exists taught boolean not null default false;
