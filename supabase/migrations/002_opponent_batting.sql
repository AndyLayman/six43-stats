-- Opponent batting tracking
-- Allows full at-bat tracking for opponent batters during their half-innings

-- Opponent lineup (batters entered on-the-fly during the game)
CREATE TABLE IF NOT EXISTS opponent_lineup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  batting_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opponent_lineup_game ON opponent_lineup(game_id);

-- Add team column to plate_appearances so we can distinguish our PAs from opponent PAs
ALTER TABLE plate_appearances ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'us' CHECK (team IN ('us', 'them'));

-- Make player_id nullable (opponent PAs won't have one)
ALTER TABLE plate_appearances ALTER COLUMN player_id DROP NOT NULL;

-- Add opponent_batter_id for opponent PAs
ALTER TABLE plate_appearances ADD COLUMN IF NOT EXISTS opponent_batter_id UUID REFERENCES opponent_lineup(id);

-- Add opponent runner and batter tracking to game_state
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS opponent_batter_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS opponent_runner_first UUID REFERENCES opponent_lineup(id);
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS opponent_runner_second UUID REFERENCES opponent_lineup(id);
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS opponent_runner_third UUID REFERENCES opponent_lineup(id);

-- Update batting_stats_season view to only include our team's plate appearances
CREATE OR REPLACE VIEW batting_stats_season AS
SELECT
  p.id AS player_id,
  p.name AS player_name,
  COUNT(DISTINCT pa.game_id) AS games,
  COUNT(*) AS plate_appearances,
  COUNT(*) FILTER (WHERE pa.is_at_bat) AS at_bats,
  COUNT(*) FILTER (WHERE pa.is_hit) AS hits,
  COUNT(*) FILTER (WHERE pa.result = '1B') AS singles,
  COUNT(*) FILTER (WHERE pa.result = '2B') AS doubles,
  COUNT(*) FILTER (WHERE pa.result = '3B') AS triples,
  COUNT(*) FILTER (WHERE pa.result = 'HR') AS home_runs,
  COALESCE(SUM(pa.rbis), 0) AS rbis,
  COUNT(*) FILTER (WHERE pa.result = 'BB') AS walks,
  COUNT(*) FILTER (WHERE pa.result = 'SO') AS strikeouts,
  COALESCE(SUM(pa.stolen_bases), 0) AS stolen_bases,
  COUNT(*) FILTER (WHERE pa.result = 'HBP') AS hit_by_pitch,
  COUNT(*) FILTER (WHERE pa.result = 'SAC') AS sacrifice,
  COALESCE(SUM(pa.total_bases), 0) AS total_bases,
  CASE
    WHEN COUNT(*) FILTER (WHERE pa.is_at_bat) = 0 THEN 0
    ELSE ROUND(COUNT(*) FILTER (WHERE pa.is_hit)::NUMERIC / COUNT(*) FILTER (WHERE pa.is_at_bat), 3)
  END AS avg,
  CASE
    WHEN (COUNT(*) FILTER (WHERE pa.is_at_bat) + COUNT(*) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC'))) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE pa.is_hit) + COUNT(*) FILTER (WHERE pa.result IN ('BB', 'HBP')))::NUMERIC /
      (COUNT(*) FILTER (WHERE pa.is_at_bat) + COUNT(*) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC'))),
      3
    )
  END AS obp,
  CASE
    WHEN COUNT(*) FILTER (WHERE pa.is_at_bat) = 0 THEN 0
    ELSE ROUND(COALESCE(SUM(pa.total_bases), 0)::NUMERIC / COUNT(*) FILTER (WHERE pa.is_at_bat), 3)
  END AS slg,
  CASE
    WHEN COUNT(*) FILTER (WHERE pa.is_at_bat) = 0 THEN 0
    ELSE ROUND(
      (CASE
        WHEN (COUNT(*) FILTER (WHERE pa.is_at_bat) + COUNT(*) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC'))) = 0 THEN 0
        ELSE (COUNT(*) FILTER (WHERE pa.is_hit) + COUNT(*) FILTER (WHERE pa.result IN ('BB', 'HBP')))::NUMERIC /
             (COUNT(*) FILTER (WHERE pa.is_at_bat) + COUNT(*) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC')))
      END) +
      (COALESCE(SUM(pa.total_bases), 0)::NUMERIC / COUNT(*) FILTER (WHERE pa.is_at_bat)),
      3
    )
  END AS ops
FROM players p
LEFT JOIN plate_appearances pa ON p.id = pa.player_id AND pa.team = 'us'
GROUP BY p.id, p.name;
