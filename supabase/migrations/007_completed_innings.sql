-- Add completed_innings array column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS completed_innings INTEGER[] DEFAULT '{}';
