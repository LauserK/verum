-- backend/migrations/041_add_other_to_issue_reason.sql

-- Drop the old constraint and create a new check constraint that includes 'other'
alter table issue_documents drop constraint if exists issue_documents_reason_check;
alter table issue_documents add constraint issue_documents_reason_check check (reason in ('sale', 'adjustment', 'waste', 'internal_consumption', 'other'));
