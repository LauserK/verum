-- ============================================================
-- SEED DATA for Milestone 2 Testing
-- Run this in Supabase SQL Editor AFTER running 002_checklists.sql
-- ============================================================

-- Replace these UUIDs with your actual organization + venue IDs
-- If you don't have them yet, create them first:

-- INSERT INTO organizations (name) VALUES ('Demo Restaurant Group')
-- RETURNING id;

-- INSERT INTO venues (org_id, name, address) 
-- VALUES ('8bf9e8a9-3790-4a4b-838c-49effbac7dd9', 'Main Branch', '123 Demo St')
-- RETURNING id;

-- ============================================================
-- IMPORTANT: Replace <VENUE_ID> below with your actual venue UUID
-- ============================================================

-- Template 1: Kitchen Opening (no prerequisite)
INSERT INTO checklist_templates (venue_id, title, description, frequency)
VALUES (
  '7f7528ad-ebaa-4eb6-a224-22a5a7df0a71',
  'Kitchen Opening',
  'Daily kitchen opening inspection: equipment, cleanliness, and food safety checks',
  'daily'
) RETURNING id;
-- Save this ID as <TEMPLATE_1_ID>

-- Template 2: Temperature Monitoring (no prerequisite)
INSERT INTO checklist_templates (venue_id, title, description, frequency)
VALUES (
  '7f7528ad-ebaa-4eb6-a224-22a5a7df0a71',
  'Temperature Monitoring',
  'Check and record temperatures of refrigerators, freezers, and cooking stations',
  'shift'
) RETURNING id;
-- Save this ID as <TEMPLATE_2_ID>

-- Template 3: Closing Inspection (requires Kitchen Opening completed first)
INSERT INTO checklist_templates (venue_id, title, description, frequency, prerequisite_template_id)
VALUES (
  '7f7528ad-ebaa-4eb6-a224-22a5a7df0a71',
  'Closing Inspection',
  'End-of-day review: waste disposal, equipment shutdown, and security check',
  'daily',
  'eb071fc3-1352-489b-ab00-89e33cbb4c09'
) RETURNING id;

-- ============================================================
-- Questions for Template 1: Kitchen Opening
-- ============================================================
INSERT INTO questions (template_id, label, type, sort_order) VALUES
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'All surfaces wiped and sanitized', 'check', 1),
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'Floor swept and mopped', 'check', 2),
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'Oven pre-heated to correct temperature', 'yes_no', 3),
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'Oven temperature reading', 'slider', 4),
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'Station 1 photo', 'photo', 5),
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'Notes or observations', 'text', 6),
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'Overall cleanliness rating', 'multi_option', 7),
  ('eb071fc3-1352-489b-ab00-89e33cbb4c09', 'Stock source', 'select', 8);

-- ============================================================
-- Questions for Template 2: Temperature Monitoring
-- ============================================================
INSERT INTO questions (template_id, label, type, sort_order) VALUES
  ('5df8739b-f12b-4665-b748-4014106379f3', 'Walk-in cooler temperature', 'slider', 1),
  ('5df8739b-f12b-4665-b748-4014106379f3', 'Freezer temperature', 'slider', 2),
  ('5df8739b-f12b-4665-b748-4014106379f3', 'Hot holding station temperature', 'slider', 3),
  ('5df8739b-f12b-4665-b748-4014106379f3', 'All units within safe range', 'yes_no', 4),
  ('5df8739b-f12b-4665-b748-4014106379f3', 'Temperature log photo', 'photo', 5);

-- ============================================================
-- Questions for Template 3: Closing Inspection
-- ============================================================
INSERT INTO questions (template_id, label, type, sort_order) VALUES
  ('41e97439-b128-44a6-9c23-5110c6bca8ab', 'All equipment turned off', 'check', 1),
  ('41e97439-b128-44a6-9c23-5110c6bca8ab', 'Waste disposed properly', 'check', 2),
  ('41e97439-b128-44a6-9c23-5110c6bca8ab', 'Doors and windows secured', 'check', 3),
  ('41e97439-b128-44a6-9c23-5110c6bca8ab', 'Closing notes', 'text', 4);
