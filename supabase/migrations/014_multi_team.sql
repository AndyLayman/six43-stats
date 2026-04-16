-- Multi-team support: add team_id to all core tables, backfill with default team

DO $$
DECLARE default_team_id UUID;
BEGIN
  SELECT id INTO default_team_id FROM teams WHERE slug = 'default' LIMIT 1;
  IF default_team_id IS NULL THEN
    RAISE EXCEPTION 'No default team found. Create a team with slug=default first.';
  END IF;

  -- Core data tables
  ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE players SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE players ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE games ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE games SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE games ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE practices ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE practices SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE practices ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE drills ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE drills SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE drills ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE action_items ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE action_items SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE action_items ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE chain_awards ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE chain_awards SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE chain_awards ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE venues ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE venues SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE venues ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE practice_plan_templates ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE practice_plan_templates SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE practice_plan_templates ALTER COLUMN team_id SET NOT NULL;

  ALTER TABLE sounds ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE sounds SET team_id = default_team_id WHERE team_id IS NULL;
  ALTER TABLE sounds ALTER COLUMN team_id SET NOT NULL;
END $$;

-- Convert team_settings from single-row (CHECK id=1) to team_id-based
DO $$
DECLARE default_team_id UUID;
BEGIN
  SELECT id INTO default_team_id FROM teams WHERE slug = 'default' LIMIT 1;

  ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE team_settings SET team_id = default_team_id WHERE team_id IS NULL;

  -- Drop old constraints
  ALTER TABLE team_settings DROP CONSTRAINT IF EXISTS team_settings_pkey;
  ALTER TABLE team_settings DROP CONSTRAINT IF EXISTS team_settings_id_check;
  ALTER TABLE team_settings DROP COLUMN IF EXISTS id;

  ALTER TABLE team_settings ALTER COLUMN team_id SET NOT NULL;
  ALTER TABLE team_settings ADD PRIMARY KEY (team_id);
END $$;

-- Convert league_config from single-row (CHECK id=1) to team_id-based
DO $$
DECLARE default_team_id UUID;
BEGIN
  SELECT id INTO default_team_id FROM teams WHERE slug = 'default' LIMIT 1;

  ALTER TABLE league_config ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
  UPDATE league_config SET team_id = default_team_id WHERE team_id IS NULL;

  ALTER TABLE league_config DROP CONSTRAINT IF EXISTS league_config_pkey;
  ALTER TABLE league_config DROP CONSTRAINT IF EXISTS league_config_id_check;
  ALTER TABLE league_config DROP COLUMN IF EXISTS id;

  ALTER TABLE league_config ALTER COLUMN team_id SET NOT NULL;
  ALTER TABLE league_config ADD PRIMARY KEY (team_id);
END $$;

-- Indexes for team_id filtering
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_games_team ON games(team_id);
CREATE INDEX IF NOT EXISTS idx_practices_team ON practices(team_id);
CREATE INDEX IF NOT EXISTS idx_drills_team ON drills(team_id);
CREATE INDEX IF NOT EXISTS idx_chain_awards_team ON chain_awards(team_id);
CREATE INDEX IF NOT EXISTS idx_action_items_team ON action_items(team_id);
CREATE INDEX IF NOT EXISTS idx_venues_team ON venues(team_id);
CREATE INDEX IF NOT EXISTS idx_sounds_team ON sounds(team_id);

-- Recreate views with team_id passthrough
CREATE OR REPLACE VIEW batting_stats_season AS
SELECT
  p.id AS player_id,
  p.name AS player_name,
  p.team_id,
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
GROUP BY p.id, p.name, p.team_id;

CREATE OR REPLACE VIEW fielding_stats_season AS
SELECT
  p.id AS player_id,
  p.name AS player_name,
  p.team_id,
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
GROUP BY p.id, p.name, p.team_id;
