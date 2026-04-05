"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SprayChart } from "@/components/scoring/SprayChart";
import {
  createInitialGameState,
  getCurrentBatter,
  getCurrentOpponentBatter,
  recordAtBat,
  recordOpponentAtBat,
  addOpponentBatter,
} from "@/lib/scoring/game-engine";
import { sprayToPosition, sprayCfSide, generateNotation, parseNotationToFieldingPlays, resolvePositionToPlayerId } from "@/lib/scoring/scorebook";
import { getDefaultRunnerAdvances, canDoublePlay } from "@/lib/scoring/baseball-rules";
import { isAtBat, isHit, totalBases } from "@/lib/stats/calculations";
import type { GameState, PlateAppearanceResult, RecordAtBatPayload, RunnerAdvance, Player, GameLineup, OpponentBatter, HitType } from "@/lib/scoring/types";

const RESULT_BUTTONS: { result: PlateAppearanceResult; label: string; color: string }[] = [
  { result: "1B", label: "1B", color: "bg-[#22c55e] hover:bg-[#2ad468] active:bg-[#1aab50]" },
  { result: "2B", label: "2B", color: "bg-[#3b82f6] hover:bg-[#5094f7] active:bg-[#2b6fd4]" },
  { result: "3B", label: "3B", color: "bg-[#f59e0b] hover:bg-[#f7ae30] active:bg-[#d48a09]" },
  { result: "HR", label: "HR", color: "bg-[#ef4444] hover:bg-[#f16060] active:bg-[#d43a3a]" },
  { result: "BB", label: "BB", color: "bg-[#8b5cf6] hover:bg-[#9d74f7] active:bg-[#7648d4]" },
  { result: "SO", label: "K", color: "bg-[#5A5A5A] hover:bg-[#6a6a6a] active:bg-[#4a4a4a]" },
  { result: "GO", label: "GO", color: "bg-[#3A3A3A] hover:bg-[#4a4a4a] active:bg-[#2a2a2a]" },
  { result: "FO", label: "FO", color: "bg-[#3A3A3A] hover:bg-[#4a4a4a] active:bg-[#2a2a2a]" },
  { result: "FC", label: "FC", color: "bg-[#3A3A3A] hover:bg-[#4a4a4a] active:bg-[#2a2a2a]" },
  { result: "DP", label: "DP", color: "bg-[#FF6161] hover:bg-[#ff7a7a] active:bg-[#e05050]" },
  { result: "SAC", label: "SAC", color: "bg-[#3A3A3A] hover:bg-[#4a4a4a] active:bg-[#2a2a2a]" },
  { result: "HBP", label: "HBP", color: "bg-[#8b5cf6] hover:bg-[#9d74f7] active:bg-[#7648d4]" },
  { result: "E", label: "E", color: "bg-[#f97316] hover:bg-[#fa8a3a] active:bg-[#d86210]" },
];

const NON_BATTED = ["BB", "SO", "HBP"];

const HIT_TYPE_BUTTONS: { type: HitType; label: string; icon: string }[] = [
  { type: "GB", label: "Ground", icon: "⌄" },
  { type: "LD", label: "Line Drive", icon: "―" },
  { type: "FB", label: "Fly Ball", icon: "⌃" },
  { type: "PU", label: "Pop Up", icon: "↑" },
];

export default function LiveScoringPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [stateHistory, setStateHistory] = useState<GameState[]>([]);
  const [selectedResult, setSelectedResult] = useState<PlateAppearanceResult | null>(null);
  const [sprayPoint, setSprayPoint] = useState<{ x: number; y: number } | null>(null);
  const [notationOverride, setNotationOverride] = useState<string | null>(null);
  const [rbis, setRbis] = useState(0);
  const [hitType, setHitType] = useState<HitType | null>(null);
  const [sbRunner, setSbRunner] = useState<"first" | "second" | "third" | null>(null);
  const [halfInningTransition, setHalfInningTransition] = useState<{
    fromHalf: "top" | "bottom";
    inning: number;
    score: { us: number; them: number };
    fading?: boolean;
  } | null>(null);
  const [runnerAdvanceOverrides, setRunnerAdvanceOverrides] = useState<RunnerAdvance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [playLog, setPlayLog] = useState<{ notation: string; playerName: string; inning: number; team: "us" | "them" }[]>([]);
  const [newOpponentName, setNewOpponentName] = useState("");
  const [pitchCount, setPitchCount] = useState<{ balls: number; strikes: number }>({ balls: 0, strikes: 0 });
  const [errorPosition, setErrorPosition] = useState<{ pos: number; cf?: "LC" | "RC"; key: string } | null>(null);
  const [batterHistory, setBatterHistory] = useState<{ x: number; y: number; result: PlateAppearanceResult; hitType: HitType | null }[]>([]);
  const [inningPositions, setInningPositions] = useState<{ player_id: number; position: string }[]>([]);
  const [opponentName, setOpponentName] = useState<string>("Them");
  const [ourTeamName, setOurTeamName] = useState<string>("Padres");
  const [gameLocation, setGameLocation] = useState<"home" | "away">("home");
  const [showPregame, setShowPregame] = useState(false);
  const [gameDate, setGameDate] = useState<string>("");

  // Wake Lock to prevent screen sleep during scoring
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake Lock not supported or failed — not critical
      }
    }
    requestWakeLock();
    function handleVisibility() {
      if (document.visibilityState === "visible") requestWakeLock();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      wakeLock?.release();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    async function load() {
      const [gameRes, lineupRes, playersRes, stateRes, opponentLineupRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("game_lineup").select("*").eq("game_id", gameId).order("batting_order"),
        supabase.from("players").select("*"),
        supabase.from("game_state").select("*").eq("game_id", gameId).single(),
        supabase.from("opponent_lineup").select("*").eq("game_id", gameId).order("batting_order"),
      ]);

      const lineup: GameLineup[] = lineupRes.data ?? [];
      const players: Player[] = playersRes.data ?? [];
      const oppLineup: OpponentBatter[] = opponentLineupRes.data ?? [];
      if (gameRes.data?.opponent) setOpponentName(gameRes.data.opponent);
      if (gameRes.data?.location) setGameLocation(gameRes.data.location);
      if (gameRes.data?.date) setGameDate(gameRes.data.date);

      let state: GameState;
      if (stateRes.data) {
        const sd = stateRes.data;
        // Resolve runners — could be our player or opponent batter
        function resolveRunner(playerId: number | null, oppId: string | null): import("@/lib/scoring/types").BaseRunner | null {
          if (playerId) {
            return { playerId, opponentBatterId: null, playerName: players.find((p) => p.id === playerId)?.name ?? "" };
          }
          if (oppId) {
            return { playerId: null, opponentBatterId: oppId, playerName: oppLineup.find((b) => b.id === oppId)?.name ?? "" };
          }
          return null;
        }
        state = {
          gameId,
          currentInning: sd.current_inning,
          currentHalf: sd.current_half,
          outs: sd.outs,
          runnerFirst: resolveRunner(sd.runner_first, sd.opponent_runner_first),
          runnerSecond: resolveRunner(sd.runner_second, sd.opponent_runner_second),
          runnerThird: resolveRunner(sd.runner_third, sd.opponent_runner_third),
          currentBatterIndex: sd.current_batter_index,
          opponentBatterIndex: sd.opponent_batter_index ?? 0,
          ourScore: gameRes.data?.our_score ?? 0,
          opponentScore: gameRes.data?.opponent_score ?? 0,
          lineup,
          players,
          opponentLineup: oppLineup,
        };
      } else {
        state = createInitialGameState(gameId, lineup, players);
      }

      setGameState(state);

      if (gameRes.data?.status === "scheduled") {
        setShowPregame(true);
      }

      const { data: pas } = await supabase
        .from("plate_appearances")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at");

      if (pas) {
        setPlayLog(
          pas.map((pa) => ({
            notation: pa.scorebook_notation || pa.result,
            playerName: pa.team === "them"
              ? oppLineup.find((b) => b.id === pa.opponent_batter_id)?.name ?? "Opponent"
              : players.find((p) => p.id === pa.player_id)?.name ?? "",
            inning: pa.inning,
            team: pa.team ?? "us",
          }))
        );
      }

      setLoading(false);
    }
    load();
  }, [gameId]);

  const persistState = useCallback(
    async (state: GameState) => {
      await Promise.all([
        supabase.from("game_state").upsert({
          game_id: gameId,
          current_inning: state.currentInning,
          current_half: state.currentHalf,
          outs: state.outs,
          runner_first: state.runnerFirst?.playerId ?? null,
          runner_second: state.runnerSecond?.playerId ?? null,
          runner_third: state.runnerThird?.playerId ?? null,
          opponent_runner_first: state.runnerFirst?.opponentBatterId ?? null,
          opponent_runner_second: state.runnerSecond?.opponentBatterId ?? null,
          opponent_runner_third: state.runnerThird?.opponentBatterId ?? null,
          current_batter_index: state.currentBatterIndex,
          opponent_batter_index: state.opponentBatterIndex,
          updated_at: new Date().toISOString(),
        }),
        supabase.from("games").update({
          our_score: state.ourScore,
          opponent_score: state.opponentScore,
          innings_played: state.currentHalf === "top" ? state.currentInning - 1 : state.currentInning,
        }).eq("id", gameId),
      ]);
    },
    [gameId]
  );

  function buildRunnerAdvances(result: PlateAppearanceResult, state: GameState): RunnerAdvance[] {
    return getDefaultRunnerAdvances(result, {
      first: state.runnerFirst,
      second: state.runnerSecond,
      third: state.runnerThird,
    });
  }

  async function handleConfirmAtBat() {
    if (!gameState || !selectedResult) return;

    const isOpponent = gameState.currentHalf === "top";
    const batter = isOpponent ? getCurrentOpponentBatter(gameState) : getCurrentBatter(gameState);
    if (!batter) return;
    const isBattedBall = !NON_BATTED.includes(selectedResult);

    const fieldPosition = sprayPoint ? sprayToPosition(sprayPoint.x, sprayPoint.y) : null;
    const cfSide = sprayPoint && fieldPosition === 8 ? sprayCfSide(sprayPoint.x, sprayPoint.y) : undefined;
    const baseState = {
      first: gameState.runnerFirst,
      second: gameState.runnerSecond,
      third: gameState.runnerThird,
    };
    const autoNotation = generateNotation(selectedResult, fieldPosition, baseState, cfSide);
    const notation = notationOverride ?? autoNotation;
    const runnerAdvances = runnerAdvanceOverrides ?? buildRunnerAdvances(selectedResult, gameState);

    const payload: RecordAtBatPayload = {
      result: selectedResult,
      sprayX: sprayPoint?.x ?? null,
      sprayY: sprayPoint?.y ?? null,
      rbis,
      stolenBases: 0,
      scorebookNotation: notation,
      fieldingPlays: [],
      runnerAdvances,
    };

    setStateHistory((prev) => [...prev, gameState]);
    const newState = isOpponent
      ? recordOpponentAtBat(gameState, payload)
      : recordAtBat(gameState, payload);

    // Detect half-inning switch
    const halfChanged = newState.currentHalf !== gameState.currentHalf || newState.currentInning !== gameState.currentInning;
    const fullInningCompleted = newState.currentInning > gameState.currentInning;
    if (halfChanged) {
      setHalfInningTransition({
        fromHalf: gameState.currentHalf,
        inning: gameState.currentInning,
        score: { us: newState.ourScore, them: newState.opponentScore },
      });
      setTimeout(() => setHalfInningTransition((prev) => prev ? { ...prev, fading: true } : null), 2200);
      setTimeout(() => setHalfInningTransition(null), 3000);

      // When a full inning completes (bottom → top), append to completed_innings
      if (fullInningCompleted) {
        void supabase.from("games")
          .select("completed_innings")
          .eq("id", gameId)
          .single()
          .then(({ data }) => {
            const current: number[] = data?.completed_innings ?? [];
            if (!current.includes(gameState.currentInning)) {
              void supabase.from("games").update({
                completed_innings: [...current, gameState.currentInning],
              }).eq("id", gameId);
            }
          });
      }
    }

    // Update UI immediately (optimistic) — don't wait for DB
    setGameState(newState);
    setPlayLog((prev) => [
      ...prev,
      { notation, playerName: batter.playerName, inning: gameState.currentInning, team: isOpponent ? "them" : "us" },
    ]);
    setSelectedResult(null);
    setSprayPoint(null);
    setHitType(null);
    setNotationOverride(null);
    setRunnerAdvanceOverrides(null);
    setRbis(0);
    setPitchCount({ balls: 0, strikes: 0 });
    setErrorPosition(null);

    // Persist to DB in background
    void supabase.from("plate_appearances").insert({
      game_id: gameId,
      player_id: batter.playerId ?? null,
      opponent_batter_id: batter.opponentBatterId ?? null,
      team: isOpponent ? "them" : "us",
      inning: gameState.currentInning,
      batting_order: isOpponent
        ? (gameState.opponentBatterIndex % Math.max(gameState.opponentLineup.length, 1)) + 1
        : (gameState.currentBatterIndex % gameState.lineup.length) + 1,
      result: selectedResult,
      scorebook_notation: notation,
      spray_x: sprayPoint?.x ?? null,
      spray_y: sprayPoint?.y ?? null,
      hit_type: isBattedBall ? hitType : null,
      rbis,
      stolen_bases: 0,
      is_at_bat: isAtBat(selectedResult),
      is_hit: isHit(selectedResult),
      total_bases: totalBases(selectedResult),
    }).then();

    // Auto-generate fielding plays when opponent is batting (our defense)
    if (isOpponent) {
      const fieldingPlays = parseNotationToFieldingPlays(notation, selectedResult);
      const fieldingRows = fieldingPlays
        .map((fp) => {
          const playerId = resolvePositionToPlayerId(fp.positionNumber, gameState.lineup, gameState.players, inningPositions, fp.cfSide);
          if (!playerId) return null;
          return {
            game_id: gameId,
            player_id: playerId,
            inning: gameState.currentInning,
            play_type: fp.playType,
            description: fp.description,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      // If result is E and a position was selected, record the error fielding play
      if (selectedResult === "E" && errorPosition) {
        const errorPlayerId = resolvePositionToPlayerId(errorPosition.pos, gameState.lineup, gameState.players, inningPositions, errorPosition.cf);
        if (errorPlayerId) {
          fieldingRows.push({
            game_id: gameId,
            player_id: errorPlayerId,
            inning: gameState.currentInning,
            play_type: "E",
            description: `E${errorPosition.key}`,
          });
        }
      }

      if (fieldingRows.length > 0) {
        void supabase.from("fielding_plays").insert(fieldingRows).then();
      }
    }

    persistState(newState);
  }

  async function handleAddOpponentBatter() {
    if (!gameState || !newOpponentName.trim()) return;
    const order = gameState.opponentLineup.length + 1;
    const { data } = await supabase.from("opponent_lineup").insert({
      game_id: gameId,
      name: newOpponentName.trim(),
      batting_order: order,
    }).select().single();
    if (data) {
      const batter: OpponentBatter = { id: data.id, game_id: gameId, name: data.name, batting_order: data.batting_order };
      const newState = addOpponentBatter(gameState, batter);
      setGameState(newState);
    }
    setNewOpponentName("");
  }

  async function handleUndo() {
    if (stateHistory.length === 0 || !gameState) return;
    const prevState = stateHistory[stateHistory.length - 1];
    setStateHistory((prev) => prev.slice(0, -1));
    setGameState(prevState);
    setPlayLog((prev) => prev.slice(0, -1));
    await persistState(prevState);

    const { data: lastPA } = await supabase
      .from("plate_appearances")
      .select("id, scorebook_notation, inning, team")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (lastPA) {
      await supabase.from("plate_appearances").delete().eq("id", lastPA.id);
      // Also remove fielding plays generated for this at-bat (opponent batting = our defense)
      if (lastPA.team === "them" && lastPA.scorebook_notation) {
        await supabase
          .from("fielding_plays")
          .delete()
          .eq("game_id", gameId)
          .eq("inning", lastPA.inning)
          .eq("description", lastPA.scorebook_notation);
      }
    }
  }

  async function handleStolenBase(from: "first" | "second" | "third", to: "second" | "third" | "home") {
    if (!gameState) return;
    const runner = gameState[from === "first" ? "runnerFirst" : from === "second" ? "runnerSecond" : "runnerThird"];
    if (!runner) return;

    setStateHistory((prev) => [...prev, gameState]);

    // Move the runner
    const newState = { ...gameState };
    // Clear the origin base
    if (from === "first") newState.runnerFirst = null;
    else if (from === "second") newState.runnerSecond = null;
    else newState.runnerThird = null;

    // Place on destination (or score)
    if (to === "second") newState.runnerSecond = runner;
    else if (to === "third") newState.runnerThird = runner;
    else if (to === "home") {
      // Runner scores
      if (gameState.currentHalf === "top") {
        newState.opponentScore = gameState.opponentScore + 1;
      } else {
        newState.ourScore = gameState.ourScore + 1;
      }
    }

    setGameState(newState);
    setSbRunner(null);

    // Record the SB by incrementing stolen_bases on the runner's most recent PA
    let query = supabase.from("plate_appearances").select("id, stolen_bases").eq("game_id", gameId);
    if (runner.playerId) {
      query = query.eq("player_id", runner.playerId);
    } else if (runner.opponentBatterId) {
      query = query.eq("opponent_batter_id", runner.opponentBatterId);
    }
    const { data: lastPA } = await query.order("created_at", { ascending: false }).limit(1).single();

    if (lastPA) {
      void supabase.from("plate_appearances")
        .update({ stolen_bases: (lastPA.stolen_bases || 0) + 1 })
        .eq("id", lastPA.id)
        .then();
    }

    const baseLabel = from === "first" ? "1st" : from === "second" ? "2nd" : "3rd";
    const destLabel = to === "second" ? "2nd" : to === "third" ? "3rd" : "Home";
    setPlayLog((prev) => [
      ...prev,
      { notation: `SB ${baseLabel}→${destLabel}`, playerName: runner.playerName, inning: gameState.currentInning, team: gameState.currentHalf === "top" ? "them" : "us" },
    ]);

    persistState(newState);
  }

  async function handleEndGame() {
    if (!gameState) return;
    await supabase.from("games").update({
      status: "final",
      our_score: gameState.ourScore,
      opponent_score: gameState.opponentScore,
      innings_played: gameState.currentHalf === "top" ? gameState.currentInning - 1 : gameState.currentInning,
    }).eq("id", gameId);
    router.push(`/games/${gameId}`);
  }

  // Compute derived values for hooks (must be before any early return)
  const batter = gameState ? getCurrentBatter(gameState) : null;
  const opponentBatter = gameState ? getCurrentOpponentBatter(gameState) : null;
  const isOurBatting = gameState?.currentHalf === "bottom";
  const isOpponentBatting = gameState?.currentHalf === "top";
  const activeBatter = isOurBatting ? batter : opponentBatter;

  // Fetch spray history for the current batter
  useEffect(() => {
    if (!activeBatter) { setBatterHistory([]); return; }
    async function fetchHistory() {
      let query = supabase
        .from("plate_appearances")
        .select("spray_x, spray_y, result, hit_type")
        .not("spray_x", "is", null);

      if (activeBatter!.playerId) {
        query = query.eq("player_id", activeBatter!.playerId);
      } else if (activeBatter!.opponentBatterId) {
        query = query.eq("opponent_batter_id", activeBatter!.opponentBatterId);
      } else {
        setBatterHistory([]);
        return;
      }

      const { data } = await query;
      if (data) {
        setBatterHistory(
          data
            .filter((pa: { spray_x: number | null; spray_y: number | null }) => pa.spray_x != null && pa.spray_y != null)
            .map((pa: { spray_x: number; spray_y: number; result: string; hit_type: string | null }) => ({
              x: pa.spray_x,
              y: pa.spray_y,
              result: pa.result as PlateAppearanceResult,
              hitType: (pa.hit_type as HitType) || null,
            }))
        );
      }
    }
    fetchHistory();
  }, [activeBatter?.playerId, activeBatter?.opponentBatterId]);

  // Load lineup_assignments for the current inning (who plays what position)
  useEffect(() => {
    if (!gameState) return;
    async function loadPositions() {
      const { data } = await supabase
        .from("lineup_assignments")
        .select("player_id, position")
        .eq("game_id", gameId)
        .eq("inning", gameState!.currentInning);
      if (data && data.length > 0) {
        setInningPositions(data);
      }
    }
    loadPositions();
  }, [gameState?.currentInning, gameId]);

  if (loading || !gameState) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (showPregame) {
    const homeTeam = gameLocation === "home" ? ourTeamName : opponentName;
    const awayTeam = gameLocation === "home" ? opponentName : ourTeamName;
    return (
      <div className="space-y-4 max-w-lg mx-auto pb-24">
        <h1 className="text-2xl font-extrabold tracking-tight text-gradient text-center">Pre-Game Summary</h1>

        {/* Date */}
        {gameDate && (
          <div className="text-center text-muted-foreground text-sm">
            {new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
        )}

        {/* Matchup */}
        <Card className="glass-strong gradient-border glow-primary">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-center flex-1 space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Away</div>
                <Input
                  value={awayTeam}
                  onChange={(e) => {
                    if (gameLocation === "home") setOpponentName(e.target.value);
                    else setOurTeamName(e.target.value);
                  }}
                  className="text-center text-lg font-bold h-12 bg-input/50 border-border/50 focus:border-primary/50"
                />
              </div>
              <div className="text-2xl font-extrabold text-muted-foreground">@</div>
              <div className="text-center flex-1 space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Home</div>
                <Input
                  value={homeTeam}
                  onChange={(e) => {
                    if (gameLocation === "home") setOurTeamName(e.target.value);
                    else setOpponentName(e.target.value);
                  }}
                  className="text-center text-lg font-bold h-12 bg-input/50 border-border/50 focus:border-primary/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Home/Away Toggle */}
        <Card className="glass">
          <CardContent className="p-4 space-y-2">
            <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">We are the...</div>
            <div className="flex gap-2">
              <button
                className={`flex-1 h-12 rounded-xl text-base font-bold border-2 transition-all active:scale-95 select-none ${
                  gameLocation === "home"
                    ? "bg-primary/20 text-primary border-primary/40 shadow-lg"
                    : "bg-muted/30 text-foreground border-border/50"
                }`}
                onClick={() => setGameLocation("home")}
              >
                Home Team
              </button>
              <button
                className={`flex-1 h-12 rounded-xl text-base font-bold border-2 transition-all active:scale-95 select-none ${
                  gameLocation === "away"
                    ? "bg-primary/20 text-primary border-primary/40 shadow-lg"
                    : "bg-muted/30 text-foreground border-border/50"
                }`}
                onClick={() => setGameLocation("away")}
              >
                Away Team
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Lineup Preview */}
        <Card className="glass">
          <CardContent className="p-4 space-y-2">
            <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">{ourTeamName} Lineup</div>
            {gameState.lineup.length > 0 ? (
              <div className="space-y-1">
                {gameState.lineup
                  .sort((a, b) => a.batting_order - b.batting_order)
                  .map((entry) => {
                    const player = gameState.players.find((p) => p.id === entry.player_id);
                    return (
                      <div key={entry.player_id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg">
                        <span className="text-sm font-bold text-primary w-5">{entry.batting_order}.</span>
                        <span className="text-sm font-medium flex-1">
                          {player ? `#${player.number} ${player.name}` : `Player ${entry.player_id}`}
                        </span>
                        {entry.position && (
                          <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded">{entry.position}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No lineup set — you can build it after starting.</div>
            )}
          </CardContent>
        </Card>

        {/* Start Game Button */}
        <Button
          className="w-full h-14 text-lg font-bold glow-primary active:scale-[0.98] transition-transform"
          size="lg"
          onClick={async () => {
            // Save any edits to the game record
            await supabase.from("games").update({
              opponent: opponentName,
              location: gameLocation,
              status: "in_progress",
            }).eq("id", gameId);
            setShowPregame(false);
          }}
        >
          Start Game
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg mx-auto pb-24">
      {/* Scoreboard */}
      <Card className="glass-strong gradient-border glow-primary">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-4xl sm:text-5xl font-extrabold tabular-nums text-gradient-bright">{gameState.ourScore}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium truncate max-w-[100px] mx-auto">{ourTeamName}</div>
            </div>
            <div className="text-center px-3">
              {/* Base runners diamond — tap occupied base for stolen base */}
              <svg viewBox="0 0 80 80" className="w-14 h-14 sm:w-16 sm:h-16 mx-auto">
                <line x1="40" y1="65" x2="15" y2="40" stroke="#3A3A3A" strokeWidth="1.5" />
                <line x1="15" y1="40" x2="40" y2="15" stroke="#3A3A3A" strokeWidth="1.5" />
                <line x1="40" y1="15" x2="65" y2="40" stroke="#3A3A3A" strokeWidth="1.5" />
                <line x1="65" y1="40" x2="40" y2="65" stroke="#3A3A3A" strokeWidth="1.5" />
                <rect x="37" y="62" width="6" height="6" fill="#141414" stroke="#3A3A3A" transform="rotate(45 40 65)" />
                {/* 3rd base */}
                <rect
                  x="6" y="31" width="18" height="18" fill="transparent" rx="2"
                  className={gameState.runnerThird ? "cursor-pointer" : ""}
                  onClick={() => gameState.runnerThird && setSbRunner(sbRunner === "third" ? null : "third")}
                />
                <rect x="12" y="37" width="6" height="6"
                  fill={gameState.runnerThird ? (sbRunner === "third" ? "#08DDC8" : "#08DDC8") : "#141414"}
                  stroke={gameState.runnerThird ? (sbRunner === "third" ? "#08DDC8" : "#08DDC8") : "#3A3A3A"}
                  transform="rotate(45 15 40)" pointerEvents="none"
                />
                {/* 2nd base */}
                <rect
                  x="31" y="6" width="18" height="18" fill="transparent" rx="2"
                  className={gameState.runnerSecond ? "cursor-pointer" : ""}
                  onClick={() => gameState.runnerSecond && setSbRunner(sbRunner === "second" ? null : "second")}
                />
                <rect x="37" y="12" width="6" height="6"
                  fill={gameState.runnerSecond ? (sbRunner === "second" ? "#08DDC8" : "#08DDC8") : "#141414"}
                  stroke={gameState.runnerSecond ? (sbRunner === "second" ? "#08DDC8" : "#08DDC8") : "#3A3A3A"}
                  transform="rotate(45 40 15)" pointerEvents="none"
                />
                {/* 1st base */}
                <rect
                  x="56" y="31" width="18" height="18" fill="transparent" rx="2"
                  className={gameState.runnerFirst ? "cursor-pointer" : ""}
                  onClick={() => gameState.runnerFirst && setSbRunner(sbRunner === "first" ? null : "first")}
                />
                <rect x="62" y="37" width="6" height="6"
                  fill={gameState.runnerFirst ? (sbRunner === "first" ? "#08DDC8" : "#08DDC8") : "#141414"}
                  stroke={gameState.runnerFirst ? (sbRunner === "first" ? "#08DDC8" : "#08DDC8") : "#3A3A3A"}
                  transform="rotate(45 65 40)" pointerEvents="none"
                />
              </svg>
              <div className="text-sm font-bold mt-1">
                {gameState.currentHalf === "top" ? "\u25B2" : "\u25BC"} {gameState.currentInning}
              </div>
              <div className="flex gap-1.5 mt-1 justify-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                      i < gameState.outs
                        ? "bg-[#FF6161] border-[#FF6161] shadow-[0_0_6px_rgba(255,97,97,0.5)]"
                        : "bg-transparent border-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-4xl sm:text-5xl font-extrabold tabular-nums text-gradient-bright">{gameState.opponentScore}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium truncate max-w-[100px] mx-auto">{opponentName}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stolen base action — shown when a runner's base is tapped */}
      {sbRunner && (() => {
        const runner = sbRunner === "first" ? gameState.runnerFirst
          : sbRunner === "second" ? gameState.runnerSecond
          : gameState.runnerThird;
        if (!runner) return null;
        const baseLabel = sbRunner === "first" ? "1st" : sbRunner === "second" ? "2nd" : "3rd";
        const destinations: { to: "second" | "third" | "home"; label: string }[] = [];
        if (sbRunner === "first") {
          destinations.push({ to: "second", label: "Stole 2nd" });
          if (!gameState.runnerSecond) destinations.push({ to: "third", label: "Stole 3rd" });
        }
        if (sbRunner === "second") {
          destinations.push({ to: "third", label: "Stole 3rd" });
          destinations.push({ to: "home", label: "Stole Home" });
        }
        if (sbRunner === "third") {
          destinations.push({ to: "home", label: "Stole Home" });
        }
        return (
          <Card className="border-primary/30 bg-primary/5 animate-slide-up">
            <CardContent className="p-3 sm:p-4">
              <div className="text-center mb-2">
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Runner on {baseLabel}</div>
                <div className="text-lg font-extrabold text-gradient-bright">{runner.playerName}</div>
              </div>
              <div className="flex gap-2 justify-center">
                {destinations.map(({ to, label }) => (
                  <button
                    key={to}
                    className="h-10 px-4 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 select-none bg-[#08DDC8] hover:bg-[#1ae8d4] text-white border-transparent shadow-md"
                    onClick={() => handleStolenBase(sbRunner, to)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  className="h-10 px-4 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 select-none bg-muted/30 text-foreground border-border/50 hover:bg-accent"
                  onClick={() => setSbRunner(null)}
                >
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Game controls — near scoreboard */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={handleUndo}
          disabled={stateHistory.length === 0}
          className="h-9 px-4 text-sm active:scale-95 transition-all border-border/50"
        >
          Undo
        </Button>
        <Button
          variant="ghost"
          onClick={handleEndGame}
          className="h-9 px-4 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          End Game
        </Button>
      </div>

      {/* Opponent batting — new batter entry if needed */}
      {isOpponentBatting && (
        <>
          {opponentBatter ? (
            <Card className="border-primary/30 bg-primary/5 animate-slide-up">
              <CardContent className="p-3 sm:p-4">
                <div className="text-center">
                  <div className="text-xs text-gradient uppercase tracking-widest font-semibold">Opponent Batting</div>
                  <div className="text-2xl sm:text-xl font-extrabold mt-0.5 text-gradient-bright">{opponentBatter.playerName}</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass animate-slide-up">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-lg text-gradient">New Opponent Batter</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOpponentName}
                    onChange={(e) => setNewOpponentName(e.target.value)}
                    placeholder="Batter name or #"
                    className="flex-1 h-12 rounded-xl border-2 border-border/50 bg-muted/30 px-3 text-base font-medium placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleAddOpponentBatter()}
                    autoFocus
                  />
                  <Button
                    onClick={handleAddOpponentBatter}
                    disabled={!newOpponentName.trim()}
                    className="h-12 px-5 text-base font-bold glow-primary"
                  >
                    Add
                  </Button>
                </div>
                {gameState.opponentLineup.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Lineup: {gameState.opponentLineup.map((b) => b.name).join(", ")}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full h-11 text-sm font-semibold border-border/50 hover:border-primary/30 hover:bg-primary/10"
                      onClick={() => {
                        setGameState((prev) =>
                          prev ? { ...prev, opponentBatterIndex: prev.opponentBatterIndex % prev.opponentLineup.length } : prev
                        );
                      }}
                    >
                      Back to top — {gameState.opponentLineup[gameState.opponentBatterIndex % gameState.opponentLineup.length]?.name}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Our batting — current batter display */}
      {isOurBatting && batter && (
        <Card className="border-primary/30 bg-primary/5 animate-slide-up">
          <CardContent className="p-3 sm:p-4">
            <div className="text-center">
              <div className="text-xs text-gradient uppercase tracking-widest font-semibold">Now Batting</div>
              <div className="text-2xl sm:text-xl font-extrabold mt-0.5 text-gradient-bright">{batter.playerName}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lineup builder if our lineup is empty */}
      {isOurBatting && !batter && gameState && (
        <Card className="glass animate-slide-up">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-lg text-gradient">Set Batting Order</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 space-y-3">
            <p className="text-sm text-muted-foreground">No lineup set for this game. Tap players in batting order:</p>
            {gameState.lineup.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Current order: {gameState.lineup.map((l, i) => `${i + 1}. ${gameState.players.find((p) => p.id === l.player_id)?.name}`).join(", ")}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {gameState.players
                .filter((p) => !gameState.lineup.some((l) => l.player_id === p.id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <button
                    key={p.id}
                    className="h-11 rounded-xl text-sm font-semibold border-2 border-border/50 bg-muted/30 hover:bg-accent hover:border-border active:scale-95 transition-all"
                    onClick={async () => {
                      const order = gameState.lineup.length + 1;
                      await supabase.from("game_lineup").insert({
                        game_id: gameId,
                        player_id: p.id,
                        batting_order: order,
                      });
                      const newLineup = [...gameState.lineup, { id: "", game_id: gameId, player_id: p.id, batting_order: order, position: "" }];
                      setGameState({ ...gameState, lineup: newLineup });
                    }}
                  >
                    #{p.number} {p.name}
                  </button>
                ))}
            </div>
            {gameState.lineup.length > 0 && (
              <Button
                className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-[#08DDC8] via-[#83DD68] to-[#CF59F3] text-white"
                onClick={() => setGameState({ ...gameState })}
              >
                Start Scoring ({gameState.lineup.length} batters)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* At-bat flow — shared for both halves */}
      {activeBatter && (
        <>
          {/* Pitch counter */}
          <Card className="glass">
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-3xl font-extrabold tabular-nums text-gradient-bright">{pitchCount.balls}-{pitchCount.strikes}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">Count</div>
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {Array.from({ length: pitchCount.balls }).map((_, i) => (
                      <div key={`b-${i}`} className="w-3 h-3 rounded-full bg-[#83DD68] border-2 border-[#83DD68]" />
                    ))}
                    {pitchCount.balls === 0 && <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />}
                    <span className="text-[10px] text-muted-foreground ml-0.5">B</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {Array.from({ length: pitchCount.strikes }).map((_, i) => (
                      <div key={`s-${i}`} className="w-3 h-3 rounded-full bg-[#FF6161] border-2 border-[#FF6161]" />
                    ))}
                    {pitchCount.strikes === 0 && <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />}
                    <span className="text-[10px] text-muted-foreground ml-0.5">S</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className="h-12 rounded-xl text-sm font-bold border-2 border-[#83DD68]/30 bg-[#83DD68]/10 text-[#83DD68] active:scale-95 transition-all select-none"
                  onClick={() => {
                    setPitchCount({ ...pitchCount, balls: pitchCount.balls + 1 });
                  }}
                >
                  Ball
                </button>
                <button
                  className="h-12 rounded-xl text-sm font-bold border-2 border-[#FF6161]/30 bg-[#FF6161]/10 text-[#FF6161] active:scale-95 transition-all select-none"
                  onClick={() => {
                    setPitchCount({ ...pitchCount, strikes: pitchCount.strikes + 1 });
                  }}
                >
                  Strike
                </button>
                <button
                  className="h-12 rounded-xl text-sm font-bold border-2 border-border/30 text-muted-foreground active:scale-95 transition-all select-none"
                  onClick={() => {
                    setPitchCount({ ...pitchCount, strikes: pitchCount.strikes + 1 });
                  }}
                >
                  Foul
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Spray chart + hit type */}
          <Card className="glass">
            <CardContent className="px-1 pt-1 pb-3 space-y-3">
              <div className="flex justify-center">
                <SprayChart
                  onClick={(x, y) => setSprayPoint({ x, y })}
                  selectedPoint={sprayPoint}
                  hitType={hitType}
                  ghostMarkers={batterHistory}
                  runners={{
                    first: !!gameState.runnerFirst,
                    second: !!gameState.runnerSecond,
                    third: !!gameState.runnerThird,
                  }}
                  className="w-full touch-none"
                />
              </div>
              {/* Clear + hit type buttons — inline below spray chart */}
              {sprayPoint && (!selectedResult || !NON_BATTED.includes(selectedResult)) && (
                <div className="grid grid-cols-5 gap-2">
                  <button
                    className="h-10 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 select-none bg-muted/30 text-muted-foreground border-border/50 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50"
                    onClick={() => { setSprayPoint(null); setHitType(null); }}
                  >
                    Clear
                  </button>
                  {HIT_TYPE_BUTTONS.map(({ type, label }) => (
                    <button
                      key={type}
                      className={`h-10 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 select-none ${
                        hitType === type
                          ? "bg-primary text-primary-foreground border-transparent shadow-lg glow-primary"
                          : "bg-muted/30 text-foreground border-border/50 hover:bg-accent hover:border-border"
                      }`}
                      onClick={() => setHitType(hitType === type ? null : type)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Result buttons */}
          <Card className="glass">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-lg text-gradient">Result</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {RESULT_BUTTONS.filter(({ result }) => {
                  const baseState = {
                    first: gameState.runnerFirst,
                    second: gameState.runnerSecond,
                    third: gameState.runnerThird,
                  };
                  // No spray dot: only show non-batted results (BB, K, HBP)
                  if (!sprayPoint && !NON_BATTED.includes(result)) return false;
                  // Spray dot placed: hide non-batted results
                  if (sprayPoint && NON_BATTED.includes(result)) return false;
                  // Hide DP/FC when no runners on base
                  if ((result === "DP" || result === "FC") && !canDoublePlay(baseState)) return false;
                  return true;
                }).map(({ result, label, color }) => (
                  <button
                    key={result}
                    className={`h-14 sm:h-12 rounded-xl text-base font-bold border-2 transition-all active:scale-95 select-none ${
                      selectedResult === result
                        ? `${color} text-white border-transparent shadow-lg`
                        : "bg-muted/30 text-foreground border-border/50 hover:bg-accent hover:border-border"
                    }`}
                    onClick={() => {
                      setSelectedResult(result);
                      // Auto-select hit type based on result
                      if (result === "GO") setHitType("GB");
                      else if (result === "FO") setHitType("FB");
                      else if (result === "DP") setHitType("GB");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Error attribution — pick which fielder committed the error */}
          {selectedResult === "E" && isOpponentBatting && gameState.lineup.length > 0 && (
            <Card className="glass animate-slide-up border-[#f97316]/20">
              <CardContent className="p-3 sm:p-4 space-y-2">
                <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Who committed the error?</div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { pos: 1, label: "P" },
                    { pos: 2, label: "C" },
                    { pos: 3, label: "1B" },
                    { pos: 4, label: "2B" },
                    { pos: 5, label: "3B" },
                    { pos: 6, label: "SS" },
                    { pos: 7, label: "LF" },
                    { pos: 8, label: "LC", cf: "LC" as const },
                    { pos: 8, label: "RC", cf: "RC" as const },
                    { pos: 9, label: "RF" },
                  ].map(({ pos, label, cf }) => {
                    const posKey = cf ? `${pos}-${cf}` : `${pos}`;
                    const playerId = resolvePositionToPlayerId(pos, gameState.lineup, gameState.players, inningPositions, cf);
                    const player = playerId ? gameState.players.find((p) => p.id === playerId) : null;
                    return (
                      <button
                        key={posKey}
                        className={`h-12 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 select-none ${
                          errorPosition?.key === posKey
                            ? "bg-[#f97316] text-white border-transparent shadow-lg"
                            : "bg-muted/30 text-foreground border-border/50 hover:bg-accent hover:border-border"
                        }`}
                        onClick={() => setErrorPosition(errorPosition?.key === posKey ? null : { pos, cf, key: label })}
                      >
                        <div>{label}</div>
                        {player && <div className="text-[10px] opacity-70 truncate px-1">#{player.number}</div>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* RBIs — only when runs can plausibly score */}
          {selectedResult && selectedResult !== "SO" && selectedResult !== "DP" && (selectedResult === "HR" || gameState.runnerFirst || gameState.runnerSecond || gameState.runnerThird) && (
            <Card className="glass animate-slide-up">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">RBIs</div>
                  <div className="flex items-center gap-3">
                    <button
                      className="h-12 w-12 rounded-xl border-2 border-border/50 text-xl font-bold flex items-center justify-center active:bg-primary/20 active:border-primary/50 active:scale-95 transition-all select-none"
                      onClick={() => setRbis(Math.max(0, rbis - 1))}
                    >
                      -
                    </button>
                    <span className="text-2xl font-extrabold w-8 text-center tabular-nums">{rbis}</span>
                    <button
                      className="h-12 w-12 rounded-xl border-2 border-border/50 text-xl font-bold flex items-center justify-center active:bg-primary/20 active:border-primary/50 active:scale-95 transition-all select-none"
                      onClick={() => setRbis(rbis + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Runner Advance Editor — only show when result selected and runners on base */}
          {selectedResult && gameState && (gameState.runnerFirst || gameState.runnerSecond || gameState.runnerThird) && (() => {
            const defaults = buildRunnerAdvances(selectedResult, gameState);
            const advances = runnerAdvanceOverrides ?? defaults;

            // Possible destinations for each base runner
            const DEST_OPTIONS: Record<string, { to: RunnerAdvance["to"]; label: string }[]> = {
              third: [
                { to: "home", label: "Scores" },
                { to: "third", label: "Holds 3rd" },
                { to: "out", label: "Out" },
              ],
              second: [
                { to: "home", label: "Scores" },
                { to: "third", label: "To 3rd" },
                { to: "second", label: "Holds 2nd" },
                { to: "out", label: "Out" },
              ],
              first: [
                { to: "home", label: "Scores" },
                { to: "third", label: "To 3rd" },
                { to: "second", label: "To 2nd" },
                { to: "first", label: "Holds 1st" },
                { to: "out", label: "Out" },
              ],
            };

            const runners: { base: "first" | "second" | "third"; name: string }[] = [];
            if (gameState.runnerThird) runners.push({ base: "third", name: gameState.runnerThird.playerName });
            if (gameState.runnerSecond) runners.push({ base: "second", name: gameState.runnerSecond.playerName });
            if (gameState.runnerFirst) runners.push({ base: "first", name: gameState.runnerFirst.playerName });

            function getAdvanceTo(base: "first" | "second" | "third"): RunnerAdvance["to"] {
              const adv = advances.find((a) => a.from === base);
              return adv ? adv.to : base; // default: holds current base
            }

            function setAdvanceTo(base: "first" | "second" | "third", to: RunnerAdvance["to"]) {
              const current = runnerAdvanceOverrides ?? [...defaults];
              const filtered = current.filter((a) => a.from !== base);
              if (to !== base) {
                filtered.push({ from: base, to });
              }
              setRunnerAdvanceOverrides(filtered);
            }

            const isEdited = runnerAdvanceOverrides !== null;

            return (
              <Card className="glass animate-slide-up">
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-gradient">Runners</CardTitle>
                    {isEdited && (
                      <button
                        className="text-xs text-primary font-semibold hover:underline"
                        onClick={() => setRunnerAdvanceOverrides(null)}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 space-y-2">
                  {runners.map(({ base, name }) => {
                    const currentTo = getAdvanceTo(base);
                    const options = DEST_OPTIONS[base];
                    const baseLabel = base === "first" ? "1st" : base === "second" ? "2nd" : "3rd";
                    return (
                      <div key={base} className="flex items-center gap-2">
                        <div className="w-20 shrink-0">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider">{baseLabel}</div>
                          <div className="text-sm font-semibold truncate">{name}</div>
                        </div>
                        <div className="flex gap-1 flex-1 flex-wrap">
                          {options.map(({ to, label }) => (
                            <button
                              key={to}
                              className={`h-9 px-3 rounded-lg text-xs font-bold border-2 transition-all active:scale-95 select-none ${
                                currentTo === to
                                  ? to === "home"
                                    ? "bg-[#08DDC8] text-[#0A0A0A] border-transparent shadow-md"
                                    : to === "out"
                                      ? "bg-[#FF6161] text-white border-transparent shadow-md"
                                      : "bg-primary text-primary-foreground border-transparent shadow-md"
                                  : "bg-muted/30 text-foreground border-border/50 hover:bg-accent"
                              }`}
                              onClick={() => setAdvanceTo(base, to)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()}

        </>
      )}

      {/* Confirm bar — fixed at bottom of screen */}
      {activeBatter && selectedResult && (
        <div className="fixed bottom-0 left-0 right-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] glass-strong border-t border-border/50 z-40">
          <div className="max-w-lg mx-auto flex gap-2 items-center">
            <input
              type="text"
              value={notationOverride !== null ? notationOverride : (sprayPoint ? (() => { const fp = sprayToPosition(sprayPoint.x, sprayPoint.y); return generateNotation(selectedResult, fp, { first: gameState.runnerFirst, second: gameState.runnerSecond, third: gameState.runnerThird }, fp === 8 ? sprayCfSide(sprayPoint.x, sprayPoint.y) : undefined); })() : selectedResult)}
              onChange={(e) => setNotationOverride(e.target.value)}
              className="h-12 sm:h-14 min-w-0 flex-1 rounded-xl border-2 border-border/50 bg-muted/30 px-3 text-center text-base sm:text-lg font-bold tabular-nums placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none transition-colors"
            />
            <Button
              onClick={handleConfirmAtBat}
              size="lg"
              className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-bold active:scale-[0.98] transition-transform glow-primary shrink-0"
            >
              Confirm
            </Button>
          </div>
        </div>
      )}

      {/* Play log */}
      {playLog.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-lg text-gradient">Play Log</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...playLog].reverse().map((play, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border/30 last:border-0">
                  <span>
                    <span className="text-muted-foreground">Inn {play.inning}</span>{" "}
                    {play.team === "them" && <span className="text-xs text-orange-400 mr-1">[OPP]</span>}
                    <span className="font-medium">{play.playerName}</span>
                  </span>
                  <Badge variant="outline" className="border-primary/30 text-primary">{play.notation}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Half-inning transition overlay */}
      {halfInningTransition && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md transition-opacity duration-700 ${halfInningTransition.fading ? "opacity-0" : "opacity-100"}`}
          onClick={() => {
            setHalfInningTransition((prev) => prev ? { ...prev, fading: true } : null);
            setTimeout(() => setHalfInningTransition(null), 700);
          }}
        >
          <div className="text-center animate-slide-up space-y-4">
            {/* Animated baseball */}
            <div className="flex justify-center">
              <svg viewBox="0 0 24 24" className="h-20 w-20" fill="none" strokeWidth="1.5" style={{ animation: "spin-slow 2s ease-in-out" }}>
                <defs>
                  <linearGradient id="trans-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#08DDC8" />
                    <stop offset="50%" stopColor="#83DD68" />
                    <stop offset="100%" stopColor="#CF59F3" />
                  </linearGradient>
                </defs>
                <circle cx="12" cy="12" r="10.5" stroke="url(#trans-grad)" />
                <path d="M 6.5 3.5 Q 4 8 6 12 Q 8 16 6.5 20.5" stroke="url(#trans-grad)" strokeLinecap="round" />
                <path d="M 17.5 3.5 Q 20 8 18 12 Q 16 16 17.5 20.5" stroke="url(#trans-grad)" strokeLinecap="round" />
              </svg>
            </div>

            {/* Score */}
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{halfInningTransition.score.us}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Us</div>
              </div>
              <div className="text-2xl text-muted-foreground font-bold">—</div>
              <div className="text-center">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{halfInningTransition.score.them}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Them</div>
              </div>
            </div>

            {/* Inning label */}
            <div className="space-y-1">
              <div className="text-lg font-bold text-gradient">
                {halfInningTransition.fromHalf === "top" ? "Mid" : "End"} {halfInningTransition.inning}
              </div>
              <div className="text-sm text-muted-foreground">
                {halfInningTransition.fromHalf === "top"
                  ? "Switching to offense"
                  : halfInningTransition.inning < 6 ? "Switching to defense" : "Switching to defense"}
              </div>
            </div>

            {/* Tap to dismiss */}
            <div className="text-xs text-muted-foreground/50 mt-6 animate-pulse">
              Tap to continue
            </div>
          </div>

          <style>{`
            @keyframes spin-slow {
              0% { transform: rotate(0deg) scale(0.5); opacity: 0; }
              30% { transform: rotate(180deg) scale(1.1); opacity: 1; }
              50% { transform: rotate(360deg) scale(1); }
              100% { transform: rotate(360deg) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
