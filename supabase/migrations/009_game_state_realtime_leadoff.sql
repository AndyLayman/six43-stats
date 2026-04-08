-- Add leadoff_player_id to game_state for cross-app sync with Lineup app
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS leadoff_player_id INTEGER REFERENCES players(id);

-- Enable Supabase Realtime on game_state so the Lineup app can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;

-- Use FULL replica identity so UPDATE events include the complete row
ALTER TABLE game_state REPLICA IDENTITY FULL;
