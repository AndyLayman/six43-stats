-- Persist the runner-advance overrides used for each at-bat.
-- Without this column we can re-derive defaults from a result + state,
-- but we lose any custom advances the scorer specified at recording time
-- (or fixes via the edit-play feature). NULL means "use engine defaults
-- for this result against the state at this play."
--
-- Format: jsonb array of objects shaped like
--   [{ "from": "first", "to": "second" }, { "from": "second", "to": "home" }]
-- matching the RunnerAdvance type used by the scoring engine.

ALTER TABLE plate_appearances
  ADD COLUMN IF NOT EXISTS runner_advances JSONB;
