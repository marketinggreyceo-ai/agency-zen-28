ALTER TABLE chatter_periods ALTER COLUMN chatter_id DROP NOT NULL;
ALTER TABLE chatter_daily_sales ALTER COLUMN chatter_id DROP NOT NULL;
ALTER TABLE chatter_periods ADD COLUMN IF NOT EXISTS chatter_profile_id uuid REFERENCES profiles(id);