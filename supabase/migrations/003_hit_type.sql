-- Add batted ball type to plate appearances
ALTER TABLE plate_appearances ADD COLUMN IF NOT EXISTS hit_type TEXT CHECK (hit_type IN ('GB', 'FB', 'LD', 'PU'));
