-- backend/migrations/037_label_tracking.sql
alter table production_lots add column if not exists label_printed boolean default false;
