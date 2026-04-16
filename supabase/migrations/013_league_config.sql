-- League configuration: single-row table shared across all Six43 apps
CREATE TABLE IF NOT EXISTS league_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_innings INTEGER NOT NULL DEFAULT 6,
  allow_re_entry BOOLEAN NOT NULL DEFAULT true,
  mercy_rule_enabled BOOLEAN NOT NULL DEFAULT true,
  mercy_rule_run_difference INTEGER NOT NULL DEFAULT 10,
  mercy_rule_after_inning INTEGER NOT NULL DEFAULT 4,
  pitch_count_enabled BOOLEAN NOT NULL DEFAULT false,
  pitch_count_max_per_game INTEGER NOT NULL DEFAULT 85,
  pitch_count_max_per_week INTEGER NOT NULL DEFAULT 175,
  batting_order_size INTEGER NOT NULL DEFAULT 9,
  continuous_batting_order BOOLEAN NOT NULL DEFAULT false,
  extra_hitter_allowed BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO league_config DEFAULT VALUES
ON CONFLICT (id) DO NOTHING;
