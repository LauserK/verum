-- ==============================================================================
-- 005_answer_timestamps.sql
-- Add an answered_at column to the answers table to track exactly when each
-- question was answered by the user.
-- ==============================================================================

ALTER TABLE answers
ADD COLUMN answered_at TIMESTAMPTZ DEFAULT now();
