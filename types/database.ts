export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          player_id: number | null
          practice_id: string | null
          team_id: string
          text: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          player_id?: number | null
          practice_id?: string | null
          team_id: string
          text: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          player_id?: number | null
          practice_id?: string | null
          team_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "action_items_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "action_items_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_awards: {
        Row: {
          award_type: string
          created_at: string | null
          date: string
          id: string
          player_id: number
          source_id: string
          source_type: string
          team_id: string
        }
        Insert: {
          award_type: string
          created_at?: string | null
          date?: string
          id?: string
          player_id: number
          source_id: string
          source_type: string
          team_id: string
        }
        Update: {
          award_type?: string
          created_at?: string | null
          date?: string
          id?: string
          player_id?: number
          source_id?: string
          source_type?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_awards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "chain_awards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "chain_awards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_awards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          category: string
          created_at: string | null
          description: string
          duration_minutes: number | null
          id: string
          name: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string
          duration_minutes?: number | null
          id?: string
          name: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          duration_minutes?: number | null
          id?: string
          name?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drills_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fielding_plays: {
        Row: {
          description: string | null
          game_id: string
          id: string
          inning: number
          play_type: string
          player_id: number
        }
        Insert: {
          description?: string | null
          game_id: string
          id?: string
          inning: number
          play_type: string
          player_id: number
        }
        Update: {
          description?: string | null
          game_id?: string
          id?: string
          inning?: number
          play_type?: string
          player_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fielding_plays_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fielding_plays_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fielding_plays_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fielding_plays_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      game_lineup: {
        Row: {
          batting_order: number
          game_id: string
          id: string
          player_id: number
          position: string
        }
        Insert: {
          batting_order: number
          game_id: string
          id?: string
          player_id: number
          position?: string
        }
        Update: {
          batting_order?: number
          game_id?: string
          id?: string
          player_id?: number
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_lineup_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_lineup_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_lineup_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_lineup_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state: {
        Row: {
          current_batter_index: number
          current_half: string
          current_inning: number
          game_id: string
          leadoff_player_id: number | null
          opponent_batter_index: number
          opponent_runner_first: string | null
          opponent_runner_second: string | null
          opponent_runner_third: string | null
          outs: number
          runner_first: number | null
          runner_second: number | null
          runner_third: number | null
          updated_at: string
        }
        Insert: {
          current_batter_index?: number
          current_half?: string
          current_inning?: number
          game_id: string
          leadoff_player_id?: number | null
          opponent_batter_index?: number
          opponent_runner_first?: string | null
          opponent_runner_second?: string | null
          opponent_runner_third?: string | null
          outs?: number
          runner_first?: number | null
          runner_second?: number | null
          runner_third?: number | null
          updated_at?: string
        }
        Update: {
          current_batter_index?: number
          current_half?: string
          current_inning?: number
          game_id?: string
          leadoff_player_id?: number | null
          opponent_batter_index?: number
          opponent_runner_first?: string | null
          opponent_runner_second?: string | null
          opponent_runner_third?: string | null
          outs?: number
          runner_first?: number | null
          runner_second?: number | null
          runner_third?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_state_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_leadoff_player_id_fkey"
            columns: ["leadoff_player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_leadoff_player_id_fkey"
            columns: ["leadoff_player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_leadoff_player_id_fkey"
            columns: ["leadoff_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_opponent_runner_first_fkey"
            columns: ["opponent_runner_first"]
            isOneToOne: false
            referencedRelation: "opponent_lineup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_opponent_runner_second_fkey"
            columns: ["opponent_runner_second"]
            isOneToOne: false
            referencedRelation: "opponent_lineup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_opponent_runner_third_fkey"
            columns: ["opponent_runner_third"]
            isOneToOne: false
            referencedRelation: "opponent_lineup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_runner_first_fkey"
            columns: ["runner_first"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_runner_first_fkey"
            columns: ["runner_first"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_runner_first_fkey"
            columns: ["runner_first"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_runner_second_fkey"
            columns: ["runner_second"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_runner_second_fkey"
            columns: ["runner_second"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_runner_second_fkey"
            columns: ["runner_second"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_runner_third_fkey"
            columns: ["runner_third"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_runner_third_fkey"
            columns: ["runner_third"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "game_state_runner_third_fkey"
            columns: ["runner_third"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          completed_innings: Json | null
          created_at: string | null
          date: string | null
          game_time: string | null
          id: string
          innings_played: number | null
          location: string | null
          notes: string | null
          num_innings: number | null
          opponent: string | null
          opponent_color_bg: string | null
          opponent_color_fg: string | null
          opponent_logo_svg: string | null
          opponent_score: number | null
          our_score: number | null
          practice_notes: Json | null
          status: string | null
          team_id: string
          venue: string | null
          venue_address: string | null
        }
        Insert: {
          completed_innings?: Json | null
          created_at?: string | null
          date?: string | null
          game_time?: string | null
          id?: string
          innings_played?: number | null
          location?: string | null
          notes?: string | null
          num_innings?: number | null
          opponent?: string | null
          opponent_color_bg?: string | null
          opponent_color_fg?: string | null
          opponent_logo_svg?: string | null
          opponent_score?: number | null
          our_score?: number | null
          practice_notes?: Json | null
          status?: string | null
          team_id: string
          venue?: string | null
          venue_address?: string | null
        }
        Update: {
          completed_innings?: Json | null
          created_at?: string | null
          date?: string | null
          game_time?: string | null
          id?: string
          innings_played?: number | null
          location?: string | null
          notes?: string | null
          num_innings?: number | null
          opponent?: string | null
          opponent_color_bg?: string | null
          opponent_color_fg?: string | null
          opponent_logo_svg?: string | null
          opponent_score?: number | null
          our_score?: number | null
          practice_notes?: Json | null
          status?: string | null
          team_id?: string
          venue?: string | null
          venue_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_config: {
        Row: {
          allow_re_entry: boolean
          batting_order_size: number
          continuous_batting_order: boolean
          extra_hitter_allowed: boolean
          max_innings: number
          mercy_rule_after_inning: number
          mercy_rule_enabled: boolean
          mercy_rule_run_difference: number
          pitch_count_enabled: boolean
          pitch_count_max_per_game: number
          pitch_count_max_per_week: number
          team_id: string
        }
        Insert: {
          allow_re_entry?: boolean
          batting_order_size?: number
          continuous_batting_order?: boolean
          extra_hitter_allowed?: boolean
          max_innings?: number
          mercy_rule_after_inning?: number
          mercy_rule_enabled?: boolean
          mercy_rule_run_difference?: number
          pitch_count_enabled?: boolean
          pitch_count_max_per_game?: number
          pitch_count_max_per_week?: number
          team_id: string
        }
        Update: {
          allow_re_entry?: boolean
          batting_order_size?: number
          continuous_batting_order?: boolean
          extra_hitter_allowed?: boolean
          max_innings?: number
          mercy_rule_after_inning?: number
          mercy_rule_enabled?: boolean
          mercy_rule_run_difference?: number
          pitch_count_enabled?: boolean
          pitch_count_max_per_game?: number
          pitch_count_max_per_week?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_config_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      library: {
        Row: {
          artist: string | null
          category: string
          file_name: string
          id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          artist?: string | null
          category: string
          file_name: string
          id: string
          sort_order?: number | null
          title: string
        }
        Update: {
          artist?: string | null
          category?: string
          file_name?: string
          id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      lineup_assignments: {
        Row: {
          game_id: string
          id: string
          inning: number
          player_id: number
          position: string
        }
        Insert: {
          game_id: string
          id?: string
          inning: number
          player_id: number
          position: string
        }
        Update: {
          game_id?: string
          id?: string
          inning?: number
          player_id?: number
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_assignments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "lineup_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "lineup_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      opponent_lineup: {
        Row: {
          batting_order: number
          created_at: string
          game_id: string
          id: string
          name: string
        }
        Insert: {
          batting_order: number
          created_at?: string
          game_id: string
          id?: string
          name: string
        }
        Update: {
          batting_order?: number
          created_at?: string
          game_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "opponent_lineup_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      plate_appearances: {
        Row: {
          batting_order: number
          created_at: string
          game_id: string
          hit_type: string | null
          id: string
          inning: number
          is_at_bat: boolean
          is_hit: boolean
          opponent_batter_id: string | null
          player_id: number | null
          rbis: number
          result: string
          scorebook_notation: string
          spray_x: number | null
          spray_y: number | null
          stolen_bases: number
          team: string
          total_bases: number
        }
        Insert: {
          batting_order: number
          created_at?: string
          game_id: string
          hit_type?: string | null
          id?: string
          inning: number
          is_at_bat?: boolean
          is_hit?: boolean
          opponent_batter_id?: string | null
          player_id?: number | null
          rbis?: number
          result: string
          scorebook_notation?: string
          spray_x?: number | null
          spray_y?: number | null
          stolen_bases?: number
          team?: string
          total_bases?: number
        }
        Update: {
          batting_order?: number
          created_at?: string
          game_id?: string
          hit_type?: string | null
          id?: string
          inning?: number
          is_at_bat?: boolean
          is_hit?: boolean
          opponent_batter_id?: string | null
          player_id?: number | null
          rbis?: number
          result?: string
          scorebook_notation?: string
          spray_x?: number | null
          spray_y?: number | null
          stolen_bases?: number
          team?: string
          total_bases?: number
        }
        Relationships: [
          {
            foreignKeyName: "plate_appearances_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_appearances_opponent_batter_id_fkey"
            columns: ["opponent_batter_id"]
            isOneToOne: false
            referencedRelation: "opponent_lineup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "plate_appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "plate_appearances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean | null
          bats: string | null
          combo_file: string | null
          first_name: string
          id: number
          intro_file: string | null
          last_name: string
          name: string
          number: string
          photo_file: string | null
          song_file: string | null
          sort_order: number
          team_id: string
          throws: string | null
        }
        Insert: {
          active?: boolean | null
          bats?: string | null
          combo_file?: string | null
          first_name?: string
          id?: number
          intro_file?: string | null
          last_name?: string
          name: string
          number?: string
          photo_file?: string | null
          song_file?: string | null
          sort_order?: number
          team_id: string
          throws?: string | null
        }
        Update: {
          active?: boolean | null
          bats?: string | null
          combo_file?: string | null
          first_name?: string
          id?: number
          intro_file?: string | null
          last_name?: string
          name?: string
          number?: string
          photo_file?: string | null
          song_file?: string | null
          sort_order?: number
          team_id?: string
          throws?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attendance: {
        Row: {
          id: string
          player_id: number
          practice_id: string
          present: boolean
        }
        Insert: {
          id?: string
          player_id: number
          practice_id: string
          present?: boolean
        }
        Update: {
          id?: string
          player_id?: number
          practice_id?: string
          present?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "practice_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "practice_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "practice_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_attendance_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_notes: {
        Row: {
          created_at: string | null
          focus_area: string | null
          id: string
          note: string
          player_id: number
          practice_id: string
        }
        Insert: {
          created_at?: string | null
          focus_area?: string | null
          id?: string
          note: string
          player_id: number
          practice_id: string
        }
        Update: {
          created_at?: string | null
          focus_area?: string | null
          id?: string
          note?: string
          player_id?: number
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "batting_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "practice_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fielding_stats_season"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "practice_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_notes_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_plan_items: {
        Row: {
          completed: boolean | null
          drill_id: string | null
          duration_minutes: number
          id: string
          label: string
          practice_id: string
          sort_order: number
        }
        Insert: {
          completed?: boolean | null
          drill_id?: string | null
          duration_minutes?: number
          id?: string
          label: string
          practice_id: string
          sort_order?: number
        }
        Update: {
          completed?: boolean | null
          drill_id?: string | null
          duration_minutes?: number
          id?: string
          label?: string
          practice_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "practice_plan_items_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_plan_items_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_plan_template_items: {
        Row: {
          drill_id: string | null
          duration_minutes: number
          id: string
          label: string
          sort_order: number
          template_id: string
        }
        Insert: {
          drill_id?: string | null
          duration_minutes?: number
          id?: string
          label: string
          sort_order?: number
          template_id: string
        }
        Update: {
          drill_id?: string | null
          duration_minutes?: number
          id?: string
          label?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_plan_template_items_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_plan_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "practice_plan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_plan_templates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_plan_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          practice_time: string | null
          team_id: string
          title: string
          venue: string | null
          venue_address: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          practice_time?: string | null
          team_id: string
          title?: string
          venue?: string | null
          venue_address?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          practice_time?: string | null
          team_id?: string
          title?: string
          venue?: string | null
          venue_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sounds: {
        Row: {
          file_name: string
          id: number
          label: string
          sort_order: number
          team_id: string
        }
        Insert: {
          file_name: string
          id?: number
          label: string
          sort_order?: number
          team_id: string
        }
        Update: {
          file_name?: string
          id?: number
          label?: string
          sort_order?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sounds_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          player_id: number | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          player_id?: number | null
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          player_id?: number | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_settings: {
        Row: {
          color_bg: string
          color_fg: string
          logo_svg: string | null
          name: string
          team_id: string
        }
        Insert: {
          color_bg?: string
          color_fg?: string
          logo_svg?: string | null
          name?: string
          team_id: string
        }
        Update: {
          color_bg?: string
          color_fg?: string
          logo_svg?: string | null
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color_bg: string | null
          color_fg: string | null
          created_at: string | null
          created_by: string | null
          id: string
          logo_svg: string | null
          name: string
          slug: string
        }
        Insert: {
          color_bg?: string | null
          color_fg?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          logo_svg?: string | null
          name: string
          slug: string
        }
        Update: {
          color_bg?: string | null
          color_fg?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          logo_svg?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          created_at: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          address?: string
          created_at?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      batting_stats_season: {
        Row: {
          at_bats: number | null
          avg: number | null
          doubles: number | null
          games: number | null
          hit_by_pitch: number | null
          hits: number | null
          home_runs: number | null
          obp: number | null
          ops: number | null
          plate_appearances: number | null
          player_id: number | null
          player_name: string | null
          rbis: number | null
          sacrifice: number | null
          singles: number | null
          slg: number | null
          stolen_bases: number | null
          strikeouts: number | null
          team_id: string | null
          total_bases: number | null
          triples: number | null
          walks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fielding_stats_season: {
        Row: {
          assists: number | null
          errors: number | null
          fielding_pct: number | null
          games: number | null
          player_id: number | null
          player_name: string | null
          putouts: number | null
          team_id: string | null
          total_chances: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
