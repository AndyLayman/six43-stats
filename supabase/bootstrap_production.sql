-- BaseballStats Production Bootstrap
-- Run this in a new Supabase project's SQL Editor to set up the full schema
-- This combines all migrations (001-007) into a single script

-- ============================================================
-- NOTE: This assumes the 'players' and 'games' tables already exist
-- in your Supabase project. If they don't, create them first:
-- ============================================================

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  number TEXT,
  active BOOLEAN DEFAULT TRUE,
  bats TEXT DEFAULT 'Right' CHECK (bats IN ('Right', 'Left', 'Switch')),
  throws TEXT DEFAULT 'Right' CHECK (throws IN ('Right', 'Left')),
  photo_file TEXT,
  intro_file TEXT,
  song_file TEXT,
  combo_file TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opponent TEXT NOT NULL,
  location TEXT DEFAULT 'home',
  our_score INTEGER DEFAULT 0,
  opponent_score INTEGER DEFAULT 0,
  innings_played INTEGER DEFAULT 0,
  completed_innings INTEGER[] DEFAULT '{}',
  num_innings INTEGER,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Game lineup (batting order + position per game)
-- ============================================================
CREATE TABLE IF NOT EXISTS game_lineup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  batting_order INTEGER NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  UNIQUE(game_id, player_id)
);

-- ============================================================
-- Opponent lineup (batters entered on-the-fly during the game)
-- ============================================================
CREATE TABLE IF NOT EXISTS opponent_lineup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  batting_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Plate appearances (every at-bat / PA)
-- ============================================================
CREATE TABLE IF NOT EXISTS plate_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  opponent_batter_id UUID REFERENCES opponent_lineup(id),
  team TEXT NOT NULL DEFAULT 'us' CHECK (team IN ('us', 'them')),
  inning INTEGER NOT NULL,
  batting_order INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('1B', '2B', '3B', 'HR', 'BB', 'SO', 'GO', 'FO', 'FC', 'DP', 'SAC', 'HBP', 'E', 'ROE')),
  scorebook_notation TEXT NOT NULL DEFAULT '',
  spray_x REAL,
  spray_y REAL,
  hit_type TEXT CHECK (hit_type IN ('GB', 'FB', 'LD', 'PU')),
  rbis INTEGER NOT NULL DEFAULT 0,
  stolen_bases INTEGER NOT NULL DEFAULT 0,
  is_at_bat BOOLEAN NOT NULL DEFAULT TRUE,
  is_hit BOOLEAN NOT NULL DEFAULT FALSE,
  total_bases INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Fielding plays
-- ============================================================
CREATE TABLE IF NOT EXISTS fielding_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  inning INTEGER NOT NULL,
  play_type TEXT NOT NULL CHECK (play_type IN ('PO', 'A', 'E')),
  description TEXT
);

-- ============================================================
-- Lineup assignments (per-inning defensive positions)
-- ============================================================
CREATE TABLE IF NOT EXISTS lineup_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  inning INTEGER NOT NULL,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position TEXT NOT NULL
);

-- ============================================================
-- Game state (persists live scoring state for reload)
-- ============================================================
CREATE TABLE IF NOT EXISTS game_state (
  game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  current_inning INTEGER NOT NULL DEFAULT 1,
  current_half TEXT NOT NULL DEFAULT 'top' CHECK (current_half IN ('top', 'bottom')),
  outs INTEGER NOT NULL DEFAULT 0,
  runner_first INTEGER REFERENCES players(id),
  runner_second INTEGER REFERENCES players(id),
  runner_third INTEGER REFERENCES players(id),
  opponent_runner_first UUID REFERENCES opponent_lineup(id),
  opponent_runner_second UUID REFERENCES opponent_lineup(id),
  opponent_runner_third UUID REFERENCES opponent_lineup(id),
  current_batter_index INTEGER NOT NULL DEFAULT 0,
  opponent_batter_index INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_plate_appearances_game ON plate_appearances(game_id);
CREATE INDEX IF NOT EXISTS idx_plate_appearances_player ON plate_appearances(player_id);
CREATE INDEX IF NOT EXISTS idx_fielding_plays_game ON fielding_plays(game_id);
CREATE INDEX IF NOT EXISTS idx_fielding_plays_player ON fielding_plays(player_id);
CREATE INDEX IF NOT EXISTS idx_game_lineup_game ON game_lineup(game_id);
CREATE INDEX IF NOT EXISTS idx_opponent_lineup_game ON opponent_lineup(game_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(date DESC);

-- ============================================================
-- View: Aggregated batting stats per player (season)
-- ============================================================
CREATE OR REPLACE VIEW batting_stats_season AS
SELECT
  p.id AS player_id,
  TRIM(p.first_name || ' ' || p.last_name) AS player_name,
  COUNT(DISTINCT pa.game_id) AS games,
  COUNT(pa.id) AS plate_appearances,
  COUNT(pa.id) FILTER (WHERE pa.is_at_bat) AS at_bats,
  COUNT(pa.id) FILTER (WHERE pa.is_hit) AS hits,
  COUNT(pa.id) FILTER (WHERE pa.result = '1B') AS singles,
  COUNT(pa.id) FILTER (WHERE pa.result = '2B') AS doubles,
  COUNT(pa.id) FILTER (WHERE pa.result = '3B') AS triples,
  COUNT(pa.id) FILTER (WHERE pa.result = 'HR') AS home_runs,
  COALESCE(SUM(pa.rbis), 0) AS rbis,
  COUNT(pa.id) FILTER (WHERE pa.result = 'BB') AS walks,
  COUNT(pa.id) FILTER (WHERE pa.result = 'SO') AS strikeouts,
  COALESCE(SUM(pa.stolen_bases), 0) AS stolen_bases,
  COUNT(pa.id) FILTER (WHERE pa.result = 'HBP') AS hit_by_pitch,
  COUNT(pa.id) FILTER (WHERE pa.result = 'SAC') AS sacrifice,
  COALESCE(SUM(pa.total_bases), 0) AS total_bases,
  CASE
    WHEN COUNT(pa.id) FILTER (WHERE pa.is_at_bat) = 0 THEN 0
    ELSE ROUND(COUNT(pa.id) FILTER (WHERE pa.is_hit)::NUMERIC / COUNT(pa.id) FILTER (WHERE pa.is_at_bat), 3)
  END AS avg,
  CASE
    WHEN (COUNT(pa.id) FILTER (WHERE pa.is_at_bat) + COUNT(pa.id) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC'))) = 0 THEN 0
    ELSE ROUND(
      (COUNT(pa.id) FILTER (WHERE pa.is_hit) + COUNT(pa.id) FILTER (WHERE pa.result IN ('BB', 'HBP')))::NUMERIC /
      (COUNT(pa.id) FILTER (WHERE pa.is_at_bat) + COUNT(pa.id) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC'))),
      3
    )
  END AS obp,
  CASE
    WHEN COUNT(pa.id) FILTER (WHERE pa.is_at_bat) = 0 THEN 0
    ELSE ROUND(COALESCE(SUM(pa.total_bases), 0)::NUMERIC / COUNT(pa.id) FILTER (WHERE pa.is_at_bat), 3)
  END AS slg,
  CASE
    WHEN COUNT(pa.id) FILTER (WHERE pa.is_at_bat) = 0 THEN 0
    ELSE ROUND(
      (CASE
        WHEN (COUNT(pa.id) FILTER (WHERE pa.is_at_bat) + COUNT(pa.id) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC'))) = 0 THEN 0
        ELSE (COUNT(pa.id) FILTER (WHERE pa.is_hit) + COUNT(pa.id) FILTER (WHERE pa.result IN ('BB', 'HBP')))::NUMERIC /
             (COUNT(pa.id) FILTER (WHERE pa.is_at_bat) + COUNT(pa.id) FILTER (WHERE pa.result IN ('BB', 'HBP', 'SAC')))
      END) +
      (COALESCE(SUM(pa.total_bases), 0)::NUMERIC / COUNT(pa.id) FILTER (WHERE pa.is_at_bat)),
      3
    )
  END AS ops
FROM players p
LEFT JOIN plate_appearances pa ON p.id = pa.player_id AND pa.team = 'us'
GROUP BY p.id, p.first_name, p.last_name;

-- ============================================================
-- View: Aggregated fielding stats per player (season)
-- ============================================================
CREATE OR REPLACE VIEW fielding_stats_season AS
SELECT
  p.id AS player_id,
  TRIM(p.first_name || ' ' || p.last_name) AS player_name,
  COUNT(DISTINCT fp.game_id) AS games,
  COUNT(*) FILTER (WHERE fp.play_type = 'PO') AS putouts,
  COUNT(*) FILTER (WHERE fp.play_type = 'A') AS assists,
  COUNT(*) FILTER (WHERE fp.play_type = 'E') AS errors,
  COUNT(fp.id) AS total_chances,
  CASE
    WHEN COUNT(fp.id) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE fp.play_type IN ('PO', 'A')))::NUMERIC / COUNT(fp.id),
      3
    )
  END AS fielding_pct
FROM players p
LEFT JOIN fielding_plays fp ON p.id = fp.player_id
GROUP BY p.id, p.first_name, p.last_name;

-- ============================================================
-- Practice Logging
-- ============================================================

CREATE TABLE IF NOT EXISTS practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL DEFAULT 'Practice',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  focus_area TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Drill Library
-- ============================================================

CREATE TABLE IF NOT EXISTS drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Practice Plan Templates
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_plan_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES practice_plan_templates(id) ON DELETE CASCADE,
  drill_id UUID REFERENCES drills(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- Practice Plan Items (per-practice schedule)
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  drill_id UUID REFERENCES drills(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- Action Items (carry forward between practices)
-- ============================================================

CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE SET NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Practice Attendance
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(practice_id, player_id)
);

-- ============================================================
-- Venues (saved fields/parks)
-- ============================================================

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add venue columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS venue_address TEXT;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS venue_address TEXT;

-- ============================================================
-- Chain Awards (Game Chain, Hard Worker)
-- ============================================================

CREATE TABLE IF NOT EXISTS chain_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  award_type TEXT NOT NULL CHECK (award_type IN ('game_chain', 'hard_worker')),
  source_type TEXT NOT NULL CHECK (source_type IN ('game', 'practice')),
  source_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Practice Squad Groups (split squad planning)
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_squad_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_index INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS practice_squad_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES practice_squad_groups(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(group_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_groups_practice ON practice_squad_groups(practice_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_group ON practice_squad_members(group_id);
