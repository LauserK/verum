-- Migration 069: Add config JSONB to quick_integrations
-- Permite almacenar configuraciones y políticas de sincronización (auto_sync_catalog, sync_prices, etc.)

ALTER TABLE public.quick_integrations 
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{"auto_sync_catalog": true, "sync_prices": true, "auto_inject_orders": true}'::jsonb;

NOTIFY pgrst, 'reload schema';
