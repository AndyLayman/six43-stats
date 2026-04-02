"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SprayChart } from "@/components/scoring/SprayChart";
import {
  createInitialGameState,
  getCurrentBatter,
  getCurrentOpponentBatter,
  recordAtBat,
  recordOpponentAtBat,
  addOpponentBatter,
} from "@/lib/scoring/game-engine";
import { sprayToPosition, generateNotation, parseNotationToFieldingPlays, resolvePositionToPlayerId } from "@/lib/scoring/scorebook";
import { getDefaultRunnerAdvances, canDoublePlay } from "@/lib/scoring/baseball-rules";
import { isAtBat, isHit, totalBases } from "@/lib/stats/calculations";
import { POSITIONS } from "@/lib/scoring/scorebook";
import type { GameState, PlateAppearanceResult, RecordAtBatPayload, RunnerAdvance, Player, GameLineup, OpponentBatter, HitType } from "@/lib/scoring/types";

const RESULT_BUTTONS: { result: PlateAppearanceResult; label: string; color: string }[] = [
  { result: "1B", label: "1B", color: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700" },
  { result: "2B", label: "2B", color: "bg-blue-600 hover:bg-blue-500 active:bg-blue-700" },
  { result: "3B", label: "3B", color: "bg-amber-600 hover:bg-amber-500 active:bg-amber-700" },
  { result: "HR", label: "HR", color: "bg-red-600 hover:bg-red-500 active:bg-red-700" },
  { result: "BB", label: "BB", color: "bg-purple-600 hover:bg-purple-500 active:bg-purple-700" },
  { result: "SO", label: "K", color: "bg-gray-600 hover:bg-gray-500 active:bg-gray-700" },
  { result: "GO", label: "GO", color: "bg-slate-600 hover:bg-slate-500 active:bg-slate-700" },
  { result: "FO", label: "FO", color: "bg-slate-600 hover:bg-slate-500 active:bg-slate-700" },
  { result: "FC", label: "FC", color: "bg-slate-600 hover:bg-slate-500 active:bg-slate-700" },
  { result: "DP", label: "DP", color: "bg-rose-700 hover:bg-rose-600 active:bg-rose-800" },
  { result: "SAC", label: "SAC", color: "bg-slate-600 hover:bg-slate-500 active:bg-slate-700" },
  { result: "HBP", label: "HBP", color: "bg-purple-600 hover:bg-purple-500 active:bg-purple-700" },
  { result: "E", label: "E", color: "bg-orange-600 hover:bg-orange-500 active:bg-orange-700" },
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
  const [stolenBases, setStolenBases] = useState(0);
  const [hitType, setHitType] = useState<HitType | null>(null);
  const [runnerAdvanceOverrides, setRunnerAdvanceOverrides] = useState<RunnerAdvance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [playLog, setPlayLog] = useState<{ notation: string; playerName: string; inning: number; team: "us" | "them" }[]>([]);
  const [newOpponentName, setNewOpponentName] = useState("");
  const [batterHistory, setBatterHistory] = useState<{ x: number; y: number; result: PlateAppearanceResult }[]>([]);
  const [defensivePositions, setDefensivePositions] = useState<{ player_id: number; position: string }[]>([]);
  const [showPositionEditor, setShowPositionEditor] = useState(false);

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
        await supabase.from("games").update({ status: "in_progress" }).eq("id", gameId);
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
          innings_played: state.currentInning,
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
    const baseState = {
      first: gameState.runnerFirst,
      second: gameState.runnerSecond,
      third: gameState.runnerThird,
    };
    const autoNotation = generateNotation(selectedResult, fieldPosition, baseState);
    const notation = notationOverride ?? autoNotation;
    const runnerAdvances = runnerAdvanceOverrides ?? buildRunnerAdvances(selectedResult, gameState);

    const payload: RecordAtBatPayload = {
      result: selectedResult,
      sprayX: sprayPoint?.x ?? null,
      sprayY: sprayPoint?.y ?? null,
      rbis,
      stolenBases,
      scorebookNotation: notation,
      fieldingPlays: [],
      runnerAdvances,
    };

    setStateHistory((prev) => [...prev, gameState]);
    const newState = isOpponent
      ? recordOpponentAtBat(gameState, payload)
      : recordAtBat(gameState, payload);

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
    setStolenBases(0);

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
      stolen_bases: stolenBases,
      is_at_bat: isAtBat(selectedResult),
      is_hit: isHit(selectedResult),
      total_bases: totalBases(selectedResult),
    }).then();

    // Auto-generate fielding plays when opponent is batting (our defense)
    if (isOpponent) {
      const fieldingPlays = parseNotationToFieldingPlays(notation, selectedResult);
      const fieldingRows = fieldingPlays
        .map((fp) => {
          const playerId = resolvePositionToPlayerId(fp.positionNumber, gameState.lineup, gameState.players, defensivePositions);
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

  async function handleEndGame() {
    if (!gameState) return;
    await supabase.from("games").update({
      status: "final",
      our_score: gameState.ourScore,
      opponent_score: gameState.opponentScore,
      innings_played: gameState.currentInning,
    }).eq("id", gameId);
    router.push(`/games/${gameId}`);
  }

  if (loading || !gameState) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const batter = getCurrentBatter(gameState);
  const opponentBatter = getCurrentOpponentBatter(gameState);
  const isOurBatting = gameState.currentHalf === "bottom";
  const isOpponentBatting = gameState.currentHalf === "top";
  const activeBatter = isOurBatting ? batter : opponentBatter;

  // Fetch spray history for the current batter
  useEffect(() => {
    if (!activeBatter) { setBatterHistory([]); return; }
    async function fetchHistory() {
      let query = supabase
        .from("plate_appearances")
        .select("spray_x, spray_y, result")
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
            .map((pa: { spray_x: number; spray_y: number; result: string }) => ({
              x: pa.spray_x,
              y: pa.spray_y,
              result: pa.result as PlateAppearanceResult,
            }))
        );
      }
    }
    fetchHistory();
  }, [activeBatter?.playerId, activeBatter?.opponentBatterId]);

  // Load or seed defensive positions for the current inning
  useEffect(() => {
    if (!gameState) return;
    const inning = gameState.currentInning;
    async function loadPositions() {
      // Check if positions exist for this inning
      const { data } = await supabase
        .from("defensive_positions")
        .select("player_id, position")
        .eq("game_id", gameId)
        .eq("inning", inning);

      if (data && data.length > 0) {
        setDefensivePositions(data);
        return;
      }

      // No positions for this inning — seed from previous inning or game_lineup
      let seedPositions: { player_id: number; position: string }[] = [];

      if (inning > 1) {
        const { data: prev } = await supabase
          .from("defensive_positions")
          .select("player_id, position")
          .eq("game_id", gameId)
          .eq("inning", inning - 1);
        if (prev && prev.length > 0) {
          seedPositions = prev;
        }
      }

      // Fall back to game_lineup positions or player default positions
      if (seedPositions.length === 0) {
        seedPositions = gameState.lineup
          .map((entry) => {
            const pos = entry.position || gameState.players.find((p) => p.id === entry.player_id)?.position || "";
            return { player_id: entry.player_id, position: pos.toUpperCase() };
          })
          .filter((e) => e.position !== "");
      }

      if (seedPositions.length > 0) {
        const rows = seedPositions.map((sp) => ({
          game_id: gameId,
          inning,
          player_id: sp.player_id,
          position: sp.position,
        }));
        await supabase.from("defensive_positions").upsert(rows, { onConflict: "game_id,inning,player_id" }).then();
        setDefensivePositions(seedPositions);
      }
    }
    loadPositions();
  }, [gameState?.currentInning, gameId]);

  // Swap two players' positions for the current inning
  async function swapPositions(playerId1: number, playerId2: number) {
    if (!gameState) return;
    const inning = gameState.currentInning;
    const pos1 = defensivePositions.find((p) => p.player_id === playerId1)?.position ?? "";
    const pos2 = defensivePositions.find((p) => p.player_id === playerId2)?.position ?? "";
    if (!pos1 || !pos2) return;

    const updated = defensivePositions.map((p) => {
      if (p.player_id === playerId1) return { ...p, position: pos2 };
      if (p.player_id === playerId2) return { ...p, position: pos1 };
      return p;
    });
    setDefensivePositions(updated);

    // Persist: delete both then re-insert to avoid unique constraint issues
    await supabase.from("defensive_positions").delete()
      .eq("game_id", gameId).eq("inning", inning).in("player_id", [playerId1, playerId2]);
    await supabase.from("defensive_positions").insert([
      { game_id: gameId, inning, player_id: playerId1, position: pos2 },
      { game_id: gameId, inning, player_id: playerId2, position: pos1 },
    ]).then();
  }

  // Update a single player's position for the current inning
  async function updatePlayerPosition(playerId: number, newPosition: string) {
    if (!gameState) return;
    const inning = gameState.currentInning;
    const updated = defensivePositions.map((p) =>
      p.player_id === playerId ? { ...p, position: newPosition } : p
    );
    // If player wasn't in list, add them
    if (!defensivePositions.find((p) => p.player_id === playerId)) {
      updated.push({ player_id: playerId, position: newPosition });
    }
    setDefensivePositions(updated);

    await supabase.from("defensive_positions").upsert({
      game_id: gameId,
      inning,
      player_id: playerId,
      position: newPosition,
    }, { onConflict: "game_id,inning,player_id" }).then();
  }

  return (
    <div className="space-y-3 max-w-lg mx-auto pb-24">
      {/* Scoreboard */}
      <Card className="glass-strong gradient-border glow-primary">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-4xl sm:text-5xl font-extrabold tabular-nums text-gradient-bright">{gameState.ourScore}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Us</div>
            </div>
            <div className="text-center px-3">
              {/* Base runners diamond */}
              <svg viewBox="0 0 80 80" className="w-14 h-14 sm:w-16 sm:h-16 mx-auto">
                <line x1="40" y1="65" x2="15" y2="40" stroke="oklch(0.4 0.01 260)" strokeWidth="1.5" />
                <line x1="15" y1="40" x2="40" y2="15" stroke="oklch(0.4 0.01 260)" strokeWidth="1.5" />
                <line x1="40" y1="15" x2="65" y2="40" stroke="oklch(0.4 0.01 260)" strokeWidth="1.5" />
                <line x1="65" y1="40" x2="40" y2="65" stroke="oklch(0.4 0.01 260)" strokeWidth="1.5" />
                <rect x="37" y="62" width="6" height="6" fill="oklch(0.25 0.01 260)" stroke="oklch(0.4 0.01 260)" transform="rotate(45 40 65)" />
                <rect x="12" y="37" width="6" height="6" fill={gameState.runnerThird ? "oklch(0.72 0.19 160)" : "oklch(0.25 0.01 260)"} stroke={gameState.runnerThird ? "oklch(0.72 0.19 160)" : "oklch(0.4 0.01 260)"} transform="rotate(45 15 40)" />
                <rect x="37" y="12" width="6" height="6" fill={gameState.runnerSecond ? "oklch(0.72 0.19 160)" : "oklch(0.25 0.01 260)"} stroke={gameState.runnerSecond ? "oklch(0.72 0.19 160)" : "oklch(0.4 0.01 260)"} transform="rotate(45 40 15)" />
                <rect x="62" y="37" width="6" height="6" fill={gameState.runnerFirst ? "oklch(0.72 0.19 160)" : "oklch(0.25 0.01 260)"} stroke={gameState.runnerFirst ? "oklch(0.72 0.19 160)" : "oklch(0.4 0.01 260)"} transform="rotate(45 65 40)" />
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
                        ? "bg-red-500 border-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                        : "bg-transparent border-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-4xl sm:text-5xl font-extrabold tabular-nums text-gradient-bright">{gameState.opponentScore}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Them</div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Defensive positions — show when opponent is batting (our defense) */}
      {isOpponentBatting && defensivePositions.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-0 px-3 sm:px-6">
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setShowPositionEditor(!showPositionEditor)}
            >
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">
                Defense — Inn {gameState.currentInning}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {showPositionEditor ? "Hide" : "Edit"}
              </span>
            </button>
            {!showPositionEditor && (
              <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
                {defensivePositions
                  .sort((a, b) => {
                    const posOrder = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
                    return posOrder.indexOf(a.position) - posOrder.indexOf(b.position);
                  })
                  .map((dp) => {
                    const player = gameState.players.find((p) => p.id === dp.player_id);
                    return (
                      <span key={dp.player_id} className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{dp.position}</span>
                        {" "}
                        {player?.name?.split(" ").pop() ?? `#${dp.player_id}`}
                      </span>
                    );
                  })}
              </div>
            )}
          </CardHeader>
          {showPositionEditor && (
            <CardContent className="px-3 sm:px-6 pb-3 pt-2">
              <div className="space-y-1.5">
                {gameState.lineup.map((entry) => {
                  const player = gameState.players.find((p) => p.id === entry.player_id);
                  const currentPos = defensivePositions.find((dp) => dp.player_id === entry.player_id)?.position ?? "";
                  return (
                    <div key={entry.player_id} className="flex items-center gap-2">
                      <div className="flex-1 text-sm font-medium truncate">
                        {player?.name ?? `Player ${entry.player_id}`}
                      </div>
                      <div className="flex gap-1">
                        {Object.values(POSITIONS).map((pos) => (
                          <button
                            key={pos}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95 select-none ${
                              currentPos === pos
                                ? "bg-primary text-primary-foreground border-transparent shadow-md"
                                : defensivePositions.some((dp) => dp.position === pos && dp.player_id !== entry.player_id)
                                  ? "bg-muted/10 text-muted-foreground/30 border border-border/20"
                                  : "bg-muted/30 text-foreground border border-border/50 hover:bg-accent"
                            }`}
                            onClick={() => {
                              // If another player has this position, swap them
                              const otherPlayer = defensivePositions.find(
                                (dp) => dp.position === pos && dp.player_id !== entry.player_id
                              );
                              if (otherPlayer) {
                                swapPositions(entry.player_id, otherPlayer.player_id);
                              } else {
                                updatePlayerPosition(entry.player_id, pos);
                              }
                            }}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* At-bat flow — shared for both halves */}
      {activeBatter && (
        <>
          {/* Spray chart + hit type */}
          <Card className="glass">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-lg text-gradient">Tap where it went</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 space-y-3">
              <div className="flex justify-center">
                <SprayChart
                  onClick={(x, y) => setSprayPoint({ x, y })}
                  selectedPoint={sprayPoint}
                  hitType={hitType}
                  ghostMarkers={batterHistory}
                  className="!max-w-[340px] w-full touch-none"
                />
              </div>
              {/* Hit type buttons — inline below spray chart */}
              {selectedResult && !NON_BATTED.includes(selectedResult) && (
                <div className="grid grid-cols-4 gap-2">
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
                {RESULT_BUTTONS.map(({ result, label, color }) => {
                  const baseState = {
                    first: gameState.runnerFirst,
                    second: gameState.runnerSecond,
                    third: gameState.runnerThird,
                  };
                  // DP requires at least one runner; FC requires at least one runner
                  const disabled =
                    (result === "DP" && !canDoublePlay(baseState)) ||
                    (result === "FC" && !canDoublePlay(baseState));

                  return (
                    <button
                      key={result}
                      disabled={disabled}
                      className={`h-14 sm:h-12 rounded-xl text-base font-bold border-2 transition-all active:scale-95 select-none ${
                        disabled
                          ? "opacity-30 cursor-not-allowed bg-muted/10 text-muted-foreground border-border/20"
                          : selectedResult === result
                            ? `${color} text-white border-transparent shadow-lg`
                            : "bg-muted/30 text-foreground border-border/50 hover:bg-accent hover:border-border"
                      }`}
                      onClick={() => !disabled && setSelectedResult(result)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* RBI & SB */}
          {selectedResult && (
            <Card className="glass animate-slide-up">
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-medium">RBIs</div>
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
                  <div>
                    <div className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-medium">Stolen Bases</div>
                    <div className="flex items-center gap-3">
                      <button
                        className="h-12 w-12 rounded-xl border-2 border-border/50 text-xl font-bold flex items-center justify-center active:bg-primary/20 active:border-primary/50 active:scale-95 transition-all select-none"
                        onClick={() => setStolenBases(Math.max(0, stolenBases - 1))}
                      >
                        -
                      </button>
                      <span className="text-2xl font-extrabold w-8 text-center tabular-nums">{stolenBases}</span>
                      <button
                        className="h-12 w-12 rounded-xl border-2 border-border/50 text-xl font-bold flex items-center justify-center active:bg-primary/20 active:border-primary/50 active:scale-95 transition-all select-none"
                        onClick={() => setStolenBases(stolenBases + 1)}
                      >
                        +
                      </button>
                    </div>
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
                                    ? "bg-emerald-600 text-white border-transparent shadow-md"
                                    : to === "out"
                                      ? "bg-red-600 text-white border-transparent shadow-md"
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

          {/* Confirm bar — sticky at bottom */}
          {selectedResult && (
            <div className="fixed bottom-0 left-0 right-0 p-3 glass-strong border-t border-border/50 z-40">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={notationOverride !== null ? notationOverride : (sprayPoint ? generateNotation(selectedResult, sprayToPosition(sprayPoint.x, sprayPoint.y), { first: gameState.runnerFirst, second: gameState.runnerSecond, third: gameState.runnerThird }) : selectedResult)}
                  onChange={(e) => setNotationOverride(e.target.value)}
                  className="h-14 flex-1 rounded-xl border-2 border-border/50 bg-muted/30 px-4 text-center text-lg font-bold tabular-nums placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none transition-colors"
                />
                <Button
                  onClick={handleConfirmAtBat}
                  size="lg"
                  className="h-14 px-8 text-lg font-bold active:scale-[0.98] transition-transform glow-primary"
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </>
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
    </div>
  );
}
