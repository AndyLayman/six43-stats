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
