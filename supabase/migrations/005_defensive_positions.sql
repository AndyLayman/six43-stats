-- Per-inning defensive positions
-- Tracks which player plays which position each inning (positions can change mid-game)
CREATE TABLE IF NOT EXISTS defensive_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  inning INTEGER NOT NULL,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  UNIQUE(game_id, inning, player_id),
  UNIQUE(game_id, inning, position)
);

CREATE INDEX IF NOT EXISTS idx_defensive_positions_game_inning
  ON defensive_positions(game_id, inning);
