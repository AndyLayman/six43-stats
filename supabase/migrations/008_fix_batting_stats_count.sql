-- Fix batting_stats_season view: COUNT(*) returns 1 on LEFT JOIN with no matches
-- Change to COUNT(pa.id) so players with no plate appearances show 0s instead of 1

CREATE OR REPLACE VIEW batting_stats_season AS
SELECT
  p.id AS player_id,
  p.name AS player_name,
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
GROUP BY p.id, p.name;
