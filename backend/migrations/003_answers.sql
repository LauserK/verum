-- Milestone 3: Answers table + extra columns on submissions

-- Add missing columns to submissions
alter table submissions add column if not exists last_saved_at timestamp with time zone null;
alter table submissions add column if not exists auditor_notes text null;
alter table submissions add column if not exists auditor_confirmed boolean default false;

-- Answers table
create table if not exists answers (
  id uuid default uuid_generate_v4() primary key,
  submission_id uuid references submissions(id) on delete cascade,
  question_id uuid references questions(id),
  value text,
  photo_label text null,
  is_critical_failure boolean default false,
  is_non_critical_issue boolean default false,
  unique (submission_id, question_id)
);

-- Index for fast upserts
create index if not exists idx_answers_submission_question on answers (submission_id, question_id);
