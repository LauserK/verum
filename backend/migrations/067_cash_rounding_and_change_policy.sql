-- ====================================================================
-- Migration: 067_cash_rounding.sql
-- Description: Configurable cash rounding multiples and rules
-- ====================================================================

ALTER TABLE public.tenant_billing_config 
ADD COLUMN IF NOT EXISTS cash_rounding_multiple NUMERIC(10,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS cash_rounding_rule TEXT CHECK (cash_rounding_rule IN ('nearest', 'up', 'down')) DEFAULT 'nearest';
