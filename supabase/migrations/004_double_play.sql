-- Add DP to plate_appearances result constraint
ALTER TABLE plate_appearances DROP CONSTRAINT IF EXISTS plate_appearances_result_check;
ALTER TABLE plate_appearances ADD CONSTRAINT plate_appearances_result_check
  CHECK (result IN ('1B', '2B', '3B', 'HR', 'BB', 'SO', 'GO', 'FO', 'FC', 'DP', 'SAC', 'HBP', 'E', 'ROE'));
