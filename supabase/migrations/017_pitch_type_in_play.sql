-- Expand pitches.pitch_type to include the implicit pitches we now record
-- when an at-bat is confirmed:
--   - in_play: the contact pitch on a batted ball (1B/2B/3B/HR/GO/FO/FC/DP/SAC/E/ROE)
--   - hbp:     the pitch that hit the batter
-- These were previously invisible to the pitch count because the ball/strike/
-- foul buttons don't fire for them.

ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_pitch_type_check;
ALTER TABLE pitches
  ADD CONSTRAINT pitches_pitch_type_check
  CHECK (pitch_type IN ('ball', 'strike', 'foul', 'in_play', 'hbp'));
