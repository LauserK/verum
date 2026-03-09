-- ============================================================
-- FIX: Add config JSON to questions that need it
-- Run this in Supabase SQL Editor to add dynamic configuration
-- ============================================================

-- Template 1: Kitchen Opening (eb071fc3-1352-489b-ab00-89e33cbb4c09)

-- Slider: Oven temperature → range 80-250°C, target 180-220°C
UPDATE questions SET config = '{"min": 80, "max": 250, "unit": "°C", "target_min": 180, "target_max": 220}'
WHERE template_id = 'eb071fc3-1352-489b-ab00-89e33cbb4c09' AND type = 'slider';

-- Check: add descriptions
UPDATE questions SET config = '{"description": "Disinfect handles, touchpoints, and mats."}'
WHERE template_id = 'eb071fc3-1352-489b-ab00-89e33cbb4c09' AND label = 'All surfaces wiped and sanitized';

UPDATE questions SET config = '{"description": "Include corners and under equipment."}'
WHERE template_id = 'eb071fc3-1352-489b-ab00-89e33cbb4c09' AND label = 'Floor swept and mopped';

-- Multi-option: Cleanliness rating → Excellent / Good / Reject
UPDATE questions SET config = '{"options": ["Excellent", "Good", "Reject"], "label": "QUALITY CHECK"}'
WHERE template_id = 'eb071fc3-1352-489b-ab00-89e33cbb4c09' AND type = 'multi_option';

-- Select: Stock source → dropdown options
UPDATE questions SET config = '{"options": ["In-house Bakery", "External Supplier", "Central Kitchen", "Local Market"], "label": "STOCK SOURCE"}'
WHERE template_id = 'eb071fc3-1352-489b-ab00-89e33cbb4c09' AND type = 'select';

-- Photo: Station 1 photo
UPDATE questions SET config = '{"label": "STATION 1"}'
WHERE template_id = 'eb071fc3-1352-489b-ab00-89e33cbb4c09' AND type = 'photo';


-- ============================================================
-- Template 2: Temperature Monitoring (5df8739b-f12b-4665-b748-4014106379f3)
-- ============================================================

-- Walk-in cooler: 0-10°C, target 2-5°C
UPDATE questions SET config = '{"min": 0, "max": 10, "unit": "°C", "target_min": 2, "target_max": 5}'
WHERE template_id = '5df8739b-f12b-4665-b748-4014106379f3' AND label = 'Walk-in cooler temperature';

-- Freezer: -25 to 0°C, target -20 to -15°C
UPDATE questions SET config = '{"min": -25, "max": 0, "unit": "°C", "target_min": -20, "target_max": -15}'
WHERE template_id = '5df8739b-f12b-4665-b748-4014106379f3' AND label = 'Freezer temperature';

-- Hot holding: 50-100°C, target 63-75°C
UPDATE questions SET config = '{"min": 50, "max": 100, "unit": "°C", "target_min": 63, "target_max": 75}'
WHERE template_id = '5df8739b-f12b-4665-b748-4014106379f3' AND label = 'Hot holding station temperature';

-- Photo: Temperature log
UPDATE questions SET config = '{"label": "TEMPERATURE LOG"}'
WHERE template_id = '5df8739b-f12b-4665-b748-4014106379f3' AND type = 'photo';
