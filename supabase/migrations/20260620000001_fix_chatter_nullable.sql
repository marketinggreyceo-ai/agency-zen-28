-- Fix: make chatter_id nullable in chatter_periods and chatter_daily_sales
-- This allows chatters who don't have a team_members record to save data

ALTER TABLE chatter_periods 
  ALTER COLUMN chatter_id DROP NOT NULL;

ALTER TABLE chatter_daily_sales 
  ALTER COLUMN chatter_id DROP NOT NULL;

-- Add chatter_profile_id to chatter_periods if not exists
ALTER TABLE chatter_periods 
  ADD COLUMN IF NOT EXISTS chatter_profile_id uuid REFERENCES profiles(id);

-- Add index for faster lookups by profile
CREATE INDEX IF NOT EXISTS idx_chatter_periods_profile_id 
  ON chatter_periods(chatter_profile_id);

CREATE INDEX IF NOT EXISTS idx_chatter_daily_sales_profile_id 
  ON chatter_daily_sales(chatter_profile_id);
