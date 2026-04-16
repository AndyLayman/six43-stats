import { supabase } from "./supabase"

export type LeagueConfig = {
  maxInnings: number
  allowReEntry: boolean
  mercyRuleEnabled: boolean
  mercyRuleRunDifference: number
  mercyRuleAfterInning: number
  pitchCountEnabled: boolean
  pitchCountMaxPerGame: number
  pitchCountMaxPerWeek: number
  battingOrderSize: number
  continuousBattingOrder: boolean
  extraHitterAllowed: boolean
}

const defaults: LeagueConfig = {
  maxInnings: 6,
  allowReEntry: true,
  mercyRuleEnabled: true,
  mercyRuleRunDifference: 10,
  mercyRuleAfterInning: 4,
  pitchCountEnabled: false,
  pitchCountMaxPerGame: 85,
  pitchCountMaxPerWeek: 175,
  battingOrderSize: 9,
  continuousBattingOrder: false,
  extraHitterAllowed: false,
}

export async function updateLeagueConfig(teamId: string, config: LeagueConfig): Promise<boolean> {
  const { error } = await supabase
    .from("league_config")
    .upsert({
      team_id: teamId,
      max_innings: config.maxInnings,
      allow_re_entry: config.allowReEntry,
      mercy_rule_enabled: config.mercyRuleEnabled,
      mercy_rule_run_difference: config.mercyRuleRunDifference,
      mercy_rule_after_inning: config.mercyRuleAfterInning,
      pitch_count_enabled: config.pitchCountEnabled,
      pitch_count_max_per_game: config.pitchCountMaxPerGame,
      pitch_count_max_per_week: config.pitchCountMaxPerWeek,
      batting_order_size: config.battingOrderSize,
      continuous_batting_order: config.continuousBattingOrder,
      extra_hitter_allowed: config.extraHitterAllowed,
    })

  return !error
}

export async function getLeagueConfig(teamId: string): Promise<LeagueConfig> {
  const { data, error } = await supabase
    .from("league_config")
    .select("*")
    .eq("team_id", teamId)
    .single()

  if (error || !data) return defaults

  return {
    maxInnings: data.max_innings,
    allowReEntry: data.allow_re_entry,
    mercyRuleEnabled: data.mercy_rule_enabled,
    mercyRuleRunDifference: data.mercy_rule_run_difference,
    mercyRuleAfterInning: data.mercy_rule_after_inning,
    pitchCountEnabled: data.pitch_count_enabled,
    pitchCountMaxPerGame: data.pitch_count_max_per_game,
    pitchCountMaxPerWeek: data.pitch_count_max_per_week,
    battingOrderSize: data.batting_order_size,
    continuousBattingOrder: data.continuous_batting_order,
    extraHitterAllowed: data.extra_hitter_allowed,
  }
}
