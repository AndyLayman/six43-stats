"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { fullName, firstName } from "@/lib/player-name";
import { useAuth } from "@/components/auth-provider";
import { TeamLogoBadge } from "@/components/team-logo-badge";
import { ChainAwardPicker } from "@/components/chain-award-picker";
import { ChevronUp, ChevronDown } from "lucide-react";

const RESULT_BUTTONS: { result: PlateAppearanceResult; label: string; color: string }[] = [
  { result: "1B", label: "1B", color: "bg-primary text-primary-foreground" },
  { result: "2B", label: "2B", color: "bg-primary text-primary-foreground" },
  { result: "3B", label: "3B", color: "bg-primary text-primary-foreground" },
  { result: "HR", label: "HR", color: "bg-primary text-primary-foreground" },
  { result: "BB", label: "BB", color: "bg-primary text-primary-foreground" },
  { result: "SO", label: "K", color: "bg-muted-foreground" },
  { result: "GO", label: "GO", color: "bg-secondary" },
  { result: "FO", label: "FO", color: "bg-secondary" },
  { result: "FC", label: "FC", color: "bg-secondary" },
  { result: "DP", label: "DP", color: "bg-destructive" },
  { result: "SAC", label: "SAC", color: "bg-secondary" },
  { result: "HBP", label: "HBP", color: "bg-primary text-primary-foreground" },
  { result: "E", label: "E", color: "bg-destructive" },
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
  const { activeTeam } = useAuth();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [stateHistory, setStateHistory] = useState<GameState[]>([]);
  const [selectedResult, setSelectedResult] = useState<PlateAppearanceResult | null>(null);
  const [sprayPoint, setSprayPoint] = useState<{ x: number; y: number } | null>(null);
  const [notationOverride, setNotationOverride] = useState<string | null>(null);
  const [rbis, setRbis] = useState(0);
  const [hitType, setHitType] = useState<HitType | null>(null);
  const [sbRunner, setSbRunner] = useState<"first" | "second" | "third" | null>(null);
  const [scoreboardExpanded, setScoreboardExpanded] = useState(false);
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
  const [totalPitches, setTotalPitches] = useState<{ us: number; them: number }>({ us: 0, them: 0 });
  const [totalPitchesHistory, setTotalPitchesHistory] = useState<{ us: number; them: number }[]>([]);
  const [errorPosition, setErrorPosition] = useState<{ pos: number; cf?: "LC" | "RC"; key: string } | null>(null);
  const [batterHistory, setBatterHistory] = useState<{ x: number; y: number; result: PlateAppearanceResult; hitType: HitType | null }[]>([]);
  const [inningPositions, setInningPositions] = useState<{ player_id: number; position: string }[]>([]);
  const [opponentName, setOpponentName] = useState<string>("Them");
  const [opponentLogoSvg, setOpponentLogoSvg] = useState<string | null>(null);
  const [opponentColorBg, setOpponentColorBg] = useState<string | null>(null);
  const [opponentColorFg, setOpponentColorFg] = useState<string | null>(null);
  const [hitProbability, setHitProbability] = useState<number | null>(null);
  const [ourTeamName, setOurTeamName] = useState<string>("Padres");
  const [gameLocation, setGameLocation] = useState<"home" | "away">("home");
  const [showPregame, setShowPregame] = useState(false);
  const [showEndGame, setShowEndGame] = useState(false);
  const [gameNotes, setGameNotes] = useState("");
  const [gameDate, setGameDate] = useState<string>("");

  // Baseball: top of inning = away team bats, bottom = home team bats
  // When we're home, opponent bats in top; when we're away, opponent bats in bottom
  function isOpponentHalf(half: "top" | "bottom"): boolean {
    return gameLocation === "home" ? half === "top" : half === "bottom";
  }

  // --- localStorage backup ---
  const lsKey = `live-scoring-${gameId}`;

  function saveToLocal(updates: {
    gameState?: GameState;
    stateHistory?: GameState[];
    playLog?: { notation: string; playerName: string; inning: number; team: "us" | "them" }[];
    totalPitches?: { us: number; them: number };
    totalPitchesHistory?: { us: number; them: number }[];
    pitchCount?: { balls: number; strikes: number };
  }) {
    try {
      const existing = JSON.parse(localStorage.getItem(lsKey) || "{}");
      // Strip large arrays (lineup/players/opponentLineup) from gameState to save space
      let gs = updates.gameState;
      if (gs) {
        const { lineup: _l, players: _p, opponentLineup: _o, ...rest } = gs;
        (existing as Record<string, unknown>).gameState = rest;
      }
      if (updates.stateHistory) {
        existing.stateHistory = updates.stateHistory.map((s: GameState) => {
          const { lineup: _l, players: _p, opponentLineup: _o, ...rest } = s;
          return rest;
        });
      }
      if (updates.playLog) existing.playLog = updates.playLog;
      if (updates.totalPitches) existing.totalPitches = updates.totalPitches;
      if (updates.totalPitchesHistory) existing.totalPitchesHistory = updates.totalPitchesHistory;
      if (updates.pitchCount) existing.pitchCount = updates.pitchCount;
      existing.savedAt = Date.now();
      localStorage.setItem(lsKey, JSON.stringify(existing));
    } catch { /* storage full or unavailable */ }
  }

  function loadFromLocal(): {
    gameState?: Partial<GameState>;
    stateHistory?: Partial<GameState>[];
    playLog?: { notation: string; playerName: string; inning: number; team: "us" | "them" }[];
    totalPitches?: { us: number; them: number };
    totalPitchesHistory?: { us: number; them: number }[];
    pitchCount?: { balls: number; strikes: number };
    savedAt?: number;
  } | null {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

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
    if (!activeTeam) return;
    async function load() {
      const [gameRes, lineupRes, playersRes, stateRes, opponentLineupRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).eq("team_id", activeTeam!.team_id).single(),
        supabase.from("game_lineup").select("*").eq("game_id", gameId).order("batting_order"),
        supabase.from("players").select("*").eq("team_id", activeTeam!.team_id),
        supabase.from("game_state").select("*").eq("game_id", gameId).single(),
        supabase.from("opponent_lineup").select("*").eq("game_id", gameId).order("batting_order"),
      ]);

      const lineup: GameLineup[] = lineupRes.data ?? [];
      const players: Player[] = playersRes.data ?? [];
      const oppLineup: OpponentBatter[] = opponentLineupRes.data ?? [];
      const local = loadFromLocal();
      const dbFailed = !gameRes.data && !stateRes.data && lineup.length === 0 && players.length === 0;

      // If DB is completely unreachable but we have local backup, restore from it
      if (dbFailed && local?.gameState) {
        const ls = local.gameState;
        const state: GameState = {
          gameId,
          currentInning: ls.currentInning ?? 1,
          currentHalf: ls.currentHalf ?? "top",
          outs: ls.outs ?? 0,
          runnerFirst: ls.runnerFirst ?? null,
          runnerSecond: ls.runnerSecond ?? null,
          runnerThird: ls.runnerThird ?? null,
          currentBatterIndex: ls.currentBatterIndex ?? 0,
          opponentBatterIndex: ls.opponentBatterIndex ?? 0,
          ourScore: ls.ourScore ?? 0,
          opponentScore: ls.opponentScore ?? 0,
          lineup: [],
          players: [],
          opponentLineup: [],
        };
        setGameState(state);
        if (local.totalPitches) setTotalPitches(local.totalPitches);
        if (local.pitchCount) setPitchCount(local.pitchCount);
        if (local.playLog) setPlayLog(local.playLog);
        if (local.totalPitchesHistory) setTotalPitchesHistory(local.totalPitchesHistory);
        if (local.stateHistory) {
          setStateHistory(local.stateHistory.map(ls => ({
            gameId,
            currentInning: ls.currentInning ?? 1,
            currentHalf: ls.currentHalf ?? "top",
            outs: ls.outs ?? 0,
            runnerFirst: ls.runnerFirst ?? null,
            runnerSecond: ls.runnerSecond ?? null,
            runnerThird: ls.runnerThird ?? null,
            currentBatterIndex: ls.currentBatterIndex ?? 0,
            opponentBatterIndex: ls.opponentBatterIndex ?? 0,
            ourScore: ls.ourScore ?? 0,
            opponentScore: ls.opponentScore ?? 0,
            lineup: [],
            players: [],
            opponentLineup: [],
          })));
        }
        setLoading(false);
        return;
      }

      if (gameRes.data?.opponent) setOpponentName(gameRes.data.opponent);
      setOpponentLogoSvg(gameRes.data?.opponent_logo_svg ?? null);
      setOpponentColorBg(gameRes.data?.opponent_color_bg ?? null);
      setOpponentColorFg(gameRes.data?.opponent_color_fg ?? null);
      if (gameRes.data?.location) setGameLocation(gameRes.data.location);
      if (gameRes.data?.date) setGameDate(gameRes.data.date);

      let state: GameState;
      if (stateRes.data) {
        const sd = stateRes.data;
        // Resolve runners — could be our player or opponent batter
        function resolveRunner(playerId: number | null, oppId: string | null): import("@/lib/scoring/types").BaseRunner | null {
          if (playerId) {
            return { playerId, opponentBatterId: null, playerName: (() => { const p = players.find((p) => p.id === playerId); return p ? fullName(p) : ""; })() };
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
      saveToLocal({ gameState: state });

      // Restore persisted pitch counts
      if (stateRes.data) {
        const tp = { us: stateRes.data.pitches_us ?? 0, them: stateRes.data.pitches_them ?? 0 };
        setTotalPitches(tp);
        saveToLocal({ totalPitches: tp });
      }

      if (gameRes.data?.status === "scheduled") {
        setShowPregame(true);
      }

      const { data: pas } = await supabase
        .from("plate_appearances")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at");

      if (pas) {
        const log = pas.map((pa) => ({
          notation: pa.scorebook_notation || pa.result,
          playerName: pa.team === "them"
            ? oppLineup.find((b) => b.id === pa.opponent_batter_id)?.name ?? "Opponent"
            : (() => { const p = players.find((p) => p.id === pa.player_id); return p ? fullName(p) : ""; })(),
          inning: pa.inning,
          team: pa.team ?? ("us" as const),
        }));
        setPlayLog(log);
        saveToLocal({ playLog: log });
      }

      setLoading(false);
    }
    load();
  }, [gameId, activeTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch the lineup + fielding positions from the Lineup-owned tables
  // (game_lineup, lineup_assignments, players). Stats is a consumer of these
  // — the Lineup app is the authoritative writer — so whenever we re-enter
  // the pre-game summary we should pull the latest in case the coach edited
  // in Lineup between mount and now.
  const refreshLineupFromLineup = useCallback(async () => {
    if (!activeTeam) return;
    const [lineupRes, playersRes, assignRes] = await Promise.all([
      supabase.from("game_lineup").select("*").eq("game_id", gameId).order("batting_order"),
      supabase.from("players").select("*").eq("team_id", activeTeam.team_id),
      supabase.from("lineup_assignments").select("player_id, position").eq("game_id", gameId).eq("inning", 1),
    ]);
    const lineup: GameLineup[] = lineupRes.data ?? [];
    const players: Player[] = playersRes.data ?? [];
    // Defensive positions for inning 1 are authoritative for "starting positions".
    // Fall back to game_lineup.position if no inning-1 assignment exists yet.
    const assignMap = new Map((assignRes.data ?? []).map((a) => [a.player_id, a.position]));
    const lineupWithPositions: GameLineup[] = lineup.map((l) => ({
      ...l,
      position: assignMap.get(l.player_id) ?? l.position,
    }));
    setGameState((prev) => prev ? { ...prev, lineup: lineupWithPositions, players } : prev);
  }, [gameId, activeTeam]);

  // Whenever the pre-game summary opens, pull the latest from Lineup.
  useEffect(() => {
    if (showPregame) refreshLineupFromLineup();
  }, [showPregame, refreshLineupFromLineup]);

  const persistState = useCallback(
    async (state: GameState, pitches?: { us: number; them: number }) => {
      // Resolve the leadoff batter for our next at-bat
      // When opponent is batting (we're on defense), currentBatterIndex
      // points to whoever leads off next time we bat
      let leadoffPlayerId: number | null = null;
      const opponentUp = gameLocation === "home" ? state.currentHalf === "top" : state.currentHalf === "bottom";
      if (opponentUp && state.lineup.length > 0) {
        const idx = state.currentBatterIndex % state.lineup.length;
        leadoffPlayerId = state.lineup[idx].player_id;
      }
      // Use provided pitches or fall back to current state
      pitches = pitches ?? totalPitches;

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
          leadoff_player_id: leadoffPlayerId,
          pitches_us: pitches.us,
          pitches_them: pitches.them,
          updated_at: new Date().toISOString(),
        }),
        supabase.from("games").update({
          our_score: state.ourScore,
          opponent_score: state.opponentScore,
          innings_played: state.currentHalf === "top" ? state.currentInning - 1 : state.currentInning,
        }).eq("id", gameId),
      ]);
    },
    [gameId, totalPitches, gameLocation]
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

    const isOpponent = isOpponentHalf(gameState.currentHalf);
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
    // Save current total pitches for undo (pitches were already counted per-click)
    setTotalPitchesHistory((prev) => [...prev, totalPitches]);
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
    const newLogEntry = { notation, playerName: batter.playerName, inning: gameState.currentInning, team: isOpponent ? "them" as const : "us" as const };
    setPlayLog((prev) => {
      const updated = [...prev, newLogEntry];
      saveToLocal({
        gameState: newState,
        playLog: updated,
        stateHistory: [...stateHistory, gameState],
        totalPitchesHistory: [...totalPitchesHistory, totalPitches],
        pitchCount: { balls: 0, strikes: 0 },
      });
      return updated;
    });
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
    const newHistory = stateHistory.slice(0, -1);
    setStateHistory(newHistory);
    setGameState(prevState);
    setPlayLog((prev) => {
      const updated = prev.slice(0, -1);
      const newPitchHistory = totalPitchesHistory.slice(0, -1);
      saveToLocal({
        gameState: prevState,
        stateHistory: newHistory,
        playLog: updated,
        totalPitchesHistory: newPitchHistory,
      });
      return updated;
    });
    // Restore previous total pitches
    const restoredPitches = totalPitchesHistory.length > 0
      ? totalPitchesHistory[totalPitchesHistory.length - 1]
      : totalPitches;
    if (totalPitchesHistory.length > 0) {
      setTotalPitches(restoredPitches);
      setTotalPitchesHistory((prev) => prev.slice(0, -1));
      saveToLocal({ totalPitches: restoredPitches });
    }
    await persistState(prevState, restoredPitches);

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
      if (isOpponentHalf(gameState.currentHalf)) {
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
    setPlayLog((prev) => {
      const updated = [...prev, { notation: `SB ${baseLabel}→${destLabel}`, playerName: runner.playerName, inning: gameState.currentInning, team: isOpponentHalf(gameState.currentHalf) ? "them" as const : "us" as const }];
      saveToLocal({ gameState: newState, playLog: updated });
      return updated;
    });

    persistState(newState);
  }

  // Increment total pitch count for the pitching team (called on every Ball/Strike/Foul click)
  function addPitch(pitchType: "ball" | "strike" | "foul") {
    if (!gameState) return;
    const isOpponent = isOpponentHalf(gameState.currentHalf);
    const next = {
      us: isOpponent ? totalPitches.us + 1 : totalPitches.us,
      them: isOpponent ? totalPitches.them : totalPitches.them + 1,
    };
    setTotalPitches(next);
    // pitchCount is updated by the caller; save both to localStorage
    saveToLocal({ totalPitches: next });
    // Persist immediately so count survives refresh
    void supabase.from("game_state").update({
      pitches_us: next.us,
      pitches_them: next.them,
      updated_at: new Date().toISOString(),
    }).eq("game_id", gameId);

    // Store individual pitch in the pitches table
    const ab = activeBatter;
    if (ab) {
      const pitchNum = pitchCount.balls + pitchCount.strikes + 1;
      void supabase.from("pitches").insert({
        game_id: gameId,
        player_id: ab.playerId ?? null,
        opponent_batter_id: ab.opponentBatterId ?? null,
        team: isOpponent ? "them" : "us",
        inning: gameState.currentInning,
        half: gameState.currentHalf,
        pitch_type: pitchType,
        pitch_num: pitchNum,
      });
    }
  }

  function handleEndGame() {
    if (!gameState) return;
    setShowEndGame(true);
  }

  async function handleFinalizeGame() {
    if (!gameState) return;
    await supabase.from("games").update({
      status: "final",
      our_score: gameState.ourScore,
      opponent_score: gameState.opponentScore,
      innings_played: gameState.currentHalf === "top" ? gameState.currentInning - 1 : gameState.currentInning,
      notes: gameNotes.trim() || null,
    }).eq("id", gameId);
    // Clean up localStorage backup — game is done
    try { localStorage.removeItem(lsKey); } catch { /* */ }
    router.push(`/games/${gameId}`);
  }

  // Compute derived values for hooks (must be before any early return)
  const batter = gameState ? getCurrentBatter(gameState) : null;
  const opponentBatter = gameState ? getCurrentOpponentBatter(gameState) : null;
  const isOpponentBatting = gameState ? isOpponentHalf(gameState.currentHalf) : false;
  const isOurBatting = gameState ? !isOpponentBatting : false;
  const activeBatter = isOurBatting ? batter : opponentBatter;

  // Resolve current batter's photo
  const batterPlayer = batter?.playerId ? gameState?.players.find(p => p.id === batter.playerId) : null;
  const batterPhotoUrl = batterPlayer?.photo_file
    ? supabase.storage.from("media").getPublicUrl(`player-${batterPlayer.id}-photo`).data.publicUrl
    : null;

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

  // Compute hit probability for the current batter
  useEffect(() => {
    if (!activeBatter) { setHitProbability(null); return; }
    async function computeProbability() {
      let query = supabase
        .from("plate_appearances")
        .select("result")
        .order("created_at", { ascending: false });

      if (activeBatter!.playerId) {
        query = query.eq("player_id", activeBatter!.playerId);
      } else if (activeBatter!.opponentBatterId) {
        query = query.eq("opponent_batter_id", activeBatter!.opponentBatterId);
      } else {
        setHitProbability(null);
        return;
      }

      const { data: allPAs } = await query;
      if (!allPAs || allPAs.length === 0) {
        setHitProbability(null);
        return;
      }

      const hits = ["1B", "2B", "3B", "HR"];
      const atBatResults = allPAs.filter((pa) => !["BB", "HBP", "SAC"].includes(pa.result));
      if (atBatResults.length === 0) { setHitProbability(null); return; }

      // Season batting average
      const seasonHits = atBatResults.filter((pa) => hits.includes(pa.result)).length;
      const seasonAvg = seasonHits / atBatResults.length;

      // Recent form (last 10 ABs) — weighted heavier
      const recent = atBatResults.slice(0, 10);
      const recentHits = recent.filter((pa) => hits.includes(pa.result)).length;
      const recentAvg = recent.length >= 3 ? recentHits / recent.length : seasonAvg;

      // Blend: 40% season, 60% recent (recent form matters more in small samples)
      const blended = atBatResults.length < 10
        ? seasonAvg
        : seasonAvg * 0.4 + recentAvg * 0.6;

      // Situational boost: runners in scoring position adds a small bump
      const risp = gameState?.runnerSecond || gameState?.runnerThird;
      const situational = risp ? 0.03 : 0;

      const prob = Math.min(Math.max(blended + situational, 0), 1);
      setHitProbability(Math.round(prob * 100));
    }
    computeProbability();
  }, [activeBatter?.playerId, activeBatter?.opponentBatterId, gameState?.runnerSecond, gameState?.runnerThird]);

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
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">{ourTeamName} Lineup</div>
              <button
                onClick={refreshLineupFromLineup}
                className="text-xs text-muted-foreground hover:text-foreground"
                aria-label="Refresh lineup from Lineup app"
              >
                ↻ Refresh
              </button>
            </div>
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
                          {player ? `#${player.number} ${fullName(player)}` : `Player ${entry.player_id}`}
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

  if (showEndGame && gameState) {
    const innings = gameState.currentHalf === "top" ? gameState.currentInning - 1 : gameState.currentInning;
    const weWon = gameState.ourScore > gameState.opponentScore;
    const tied = gameState.ourScore === gameState.opponentScore;
    return (
      <div className="space-y-4 max-w-lg mx-auto pb-24">
        <h1 className="text-2xl font-extrabold tracking-tight text-gradient text-center">Game Over</h1>

        {/* Final Score */}
        <Card className="glass-strong gradient-border glow-primary">
          <CardContent className="p-5">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{gameState.ourScore}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">{ourTeamName}</div>
              </div>
              <div className="text-2xl font-extrabold text-muted-foreground">-</div>
              <div className="text-center">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{gameState.opponentScore}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">{opponentName}</div>
              </div>
            </div>
            <div className="text-center mt-2 text-sm text-muted-foreground">
              {innings} inning{innings !== 1 ? "s" : ""} {tied ? "• Tied" : weWon ? "• Win" : "• Loss"}
            </div>
          </CardContent>
        </Card>

        {/* Game Notes */}
        <Card className="glass">
          <CardContent className="p-4 space-y-2">
            <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Game Notes</div>
            <textarea
              value={gameNotes}
              onChange={(e) => setGameNotes(e.target.value)}
              placeholder="Key plays, highlights, things to work on..."
              rows={4}
              className="w-full rounded-xl border-2 border-border/50 bg-muted/30 px-3 py-2.5 text-sm font-medium placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none transition-colors resize-none"
              autoFocus
            />
          </CardContent>
        </Card>

        {/* Chain Awards */}
        <Card className="glass">
          <CardContent className="p-4">
            <ChainAwardPicker
              players={gameState.players}
              sourceType="game"
              sourceId={gameId}
              date={gameDate}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 text-base font-bold border-border/50"
            onClick={() => setShowEndGame(false)}
          >
            Back
          </Button>
          <Button
            className="flex-1 h-12 text-base font-bold glow-primary active:scale-[0.98] transition-transform"
            onClick={handleFinalizeGame}
          >
            Save &amp; Finish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* Expandable scoreboard — portaled to body, slides down from behind header */}
    {typeof document !== "undefined" && createPortal(
      <div className="fixed top-14 left-0 right-0 z-40 flex flex-col items-center pointer-events-none">
        {/* Scoreboard panel + tab — slide together */}
        <div
          className={`pointer-events-auto w-full max-w-lg md:max-w-4xl px-4 flex flex-col items-center transition-transform duration-300 ease-in-out ${
            scoreboardExpanded ? "translate-y-0" : "-translate-y-[calc(100%-20px)]"
          }`}
        >
          <Card className="w-full gradient-border glow-primary rounded-t-none" style={{ background: 'var(--sidebar)', borderTop: 'none' }}>
            <CardContent className="px-3 py-1.5 sm:px-4 sm:py-2">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-3xl sm:text-4xl font-extrabold tabular-nums text-gradient-bright">{gameState.ourScore}</div>
                  <div className="flex justify-center mt-1">
                    <TeamLogoBadge
                      logoSvg={activeTeam?.team_logo_svg}
                      colorBg={activeTeam?.team_color_bg}
                      colorFg={activeTeam?.team_color_fg}
                      fallback={activeTeam?.team_name ?? ourTeamName}
                      sizeClass="w-7 h-7"
                      innerSizeClass="w-5 h-5"
                      fallbackTextClass="text-sm"
                    />
                  </div>
                </div>
                <div className="text-center px-3">
                  {/* Base runners diamond — tap occupied base for stolen base */}
                  <svg viewBox="0 0 80 80" className="w-14 h-14 sm:w-16 sm:h-16 mx-auto">
                    <line x1="40" y1="65" x2="15" y2="40" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
                    <line x1="15" y1="40" x2="40" y2="15" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
                    <line x1="40" y1="15" x2="65" y2="40" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
                    <line x1="65" y1="40" x2="40" y2="65" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
                    <rect x="37" y="62" width="6" height="6" fill="#E9D7B4" transform="rotate(45 40 65)" />
                    {/* 3rd base */}
                    <rect
                      x="6" y="31" width="18" height="18" fill="transparent" rx="2"
                      className={gameState.runnerThird ? "cursor-pointer" : ""}
                      onClick={() => gameState.runnerThird && setSbRunner(sbRunner === "third" ? null : "third")}
                    />
                    <rect x="12" y="37" width="6" height="6"
                      fill={gameState.runnerThird ? "#E9D7B4" : "#111111"}
                      stroke="#E9D7B4"
                      strokeWidth="1"
                      transform="rotate(45 15 40)" pointerEvents="none"
                    />
                    {/* 2nd base */}
                    <rect
                      x="31" y="6" width="18" height="18" fill="transparent" rx="2"
                      className={gameState.runnerSecond ? "cursor-pointer" : ""}
                      onClick={() => gameState.runnerSecond && setSbRunner(sbRunner === "second" ? null : "second")}
                    />
                    <rect x="37" y="12" width="6" height="6"
                      fill={gameState.runnerSecond ? "#E9D7B4" : "#111111"}
                      stroke="#E9D7B4"
                      strokeWidth="1"
                      transform="rotate(45 40 15)" pointerEvents="none"
                    />
                    {/* 1st base */}
                    <rect
                      x="56" y="31" width="18" height="18" fill="transparent" rx="2"
                      className={gameState.runnerFirst ? "cursor-pointer" : ""}
                      onClick={() => gameState.runnerFirst && setSbRunner(sbRunner === "first" ? null : "first")}
                    />
                    <rect x="62" y="37" width="6" height="6"
                      fill={gameState.runnerFirst ? "#E9D7B4" : "#111111"}
                      stroke="#E9D7B4"
                      strokeWidth="1"
                      transform="rotate(45 65 40)" pointerEvents="none"
                    />
                  </svg>
                  <div className="flex items-center justify-center gap-0.5 text-sm font-bold mt-1">
                    {gameState.currentHalf === "top" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {gameState.currentInning}
                  </div>
                  <div className="flex gap-1 sm:gap-1.5 mt-1 justify-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 sm:w-3.5 sm:h-3.5 rounded-full border sm:border-2 transition-colors ${
                          i < gameState.outs
                            ? "bg-destructive border-destructive shadow-[0_0_6px_rgba(250,77,77,0.5)]"
                            : "bg-transparent border-muted-foreground/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-3xl sm:text-4xl font-extrabold tabular-nums text-gradient-bright">{gameState.opponentScore}</div>
                  <div className="flex justify-center mt-1">
                    <TeamLogoBadge
                      logoSvg={opponentLogoSvg}
                      colorBg={opponentColorBg}
                      colorFg={opponentColorFg}
                      fallback={opponentName}
                      sizeClass="w-7 h-7"
                      innerSizeClass="w-5 h-5"
                      fallbackTextClass="text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Pull tab — slides with the panel */}
          <button
            onClick={() => setScoreboardExpanded(!scoreboardExpanded)}
            className="flex items-center justify-center w-12 h-5 rounded-b-lg bg-sidebar border border-t-0 border-border/50 hover:bg-primary/20 transition-all active:scale-95 shrink-0"
          >
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${scoreboardExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>,
      document.body
    )}

    <div className="space-y-3 max-w-lg md:max-w-4xl mx-auto pb-24">
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
                    className="h-10 px-4 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 select-none bg-primary hover:opacity-90 text-primary-foreground border-transparent shadow-md"
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

        {/* Total Pitches — them (pitched to us) on left, us (pitched to them) on right */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
          <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Pitches</span>
          <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
            <span className="text-foreground">{totalPitches.them}</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-foreground">{totalPitches.us}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={handleEndGame}
          className="h-9 px-4 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          End Game
        </Button>
      </div>

      {/* Opponent batting — new batter entry if needed */}
      {isOpponentBatting && !opponentBatter && (
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
                Current order: {gameState.lineup.map((l, i) => { const p = gameState.players.find((p) => p.id === l.player_id); return `${i + 1}. ${p ? fullName(p) : "?"}`; }).join(", ")}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {gameState.players
                .filter((p) => !gameState.lineup.some((l) => l.player_id === p.id))
                .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
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
                    #{p.number} {fullName(p)}
                  </button>
                ))}
            </div>
            {gameState.lineup.length > 0 && (
              <Button
                className="w-full h-11 text-sm font-semibold bg-primary text-primary-foreground"
                onClick={() => setGameState({ ...gameState })}
              >
                Start Scoring ({gameState.lineup.length} batters)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Now Batting — mobile only (desktop shows in right column) */}
      {isOurBatting && batter && (
        <Card className="md:hidden border-primary/30 bg-primary/5 animate-slide-up">
          <CardContent className="p-3">
            <div className="flex items-center gap-3 justify-center">
              {batterPhotoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={batterPhotoUrl} alt="" className="h-12 w-12 rounded-full object-cover border border-primary/30 shrink-0" />
              ) : batterPlayer ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 font-bold text-lg border border-primary/30 text-gradient-bright shrink-0">
                  {batterPlayer.number}
                </div>
              ) : null}
              <div className="text-center">
                <div className="text-xs text-gradient uppercase tracking-widest font-semibold">Now Batting</div>
                <div className="text-2xl font-extrabold mt-0.5 text-gradient-bright">{batter.playerName}</div>
              {hitProbability !== null && (
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <div className="h-1.5 w-20 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${hitProbability}%`,
                        backgroundColor: hitProbability >= 40 ? "var(--success)" : hitProbability >= 25 ? "var(--primary)" : "var(--destructive)",
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{
                    color: hitProbability >= 40 ? "var(--success)" : hitProbability >= 25 ? "var(--primary)" : "var(--destructive)",
                  }}>
                    {hitProbability}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">hit</span>
                </div>
              )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opponent Batting — mobile only (desktop shows in right column) */}
      {isOpponentBatting && opponentBatter && (
        <Card className="md:hidden border-primary/30 bg-primary/5 animate-slide-up">
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-xs text-gradient uppercase tracking-widest font-semibold">Opponent Batting</div>
              <div className="text-2xl font-extrabold mt-0.5 text-gradient-bright">{opponentBatter.playerName}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* At-bat flow — shared for both halves */}
      {activeBatter && (
        <>
        {/* Pitch counter — mobile only, above spray chart */}
        <Card className="glass md:hidden">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-3xl font-extrabold tabular-nums text-gradient-bright">{pitchCount.balls}-{pitchCount.strikes}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">Count</div>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <div className="flex items-center gap-1 justify-end">
                  {Array.from({ length: Math.max(pitchCount.balls, 4) }).map((_, i) => (
                    <div key={`b-${i}`} className={`w-3 h-3 rounded-full border-2 ${i < pitchCount.balls ? "bg-success border-success" : "border-muted-foreground/30"}`} />
                  ))}
                  <span className="text-[10px] text-muted-foreground w-3">B</span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  {Array.from({ length: Math.max(pitchCount.strikes, 3) }).map((_, i) => (
                    <div key={`s-${i}`} className={`w-3 h-3 rounded-full border-2 ${i < pitchCount.strikes ? "bg-destructive border-destructive" : "border-muted-foreground/30"}`} />
                  ))}
                  <span className="text-[10px] text-muted-foreground w-3">S</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                className="h-12 rounded-xl text-sm font-bold border-2 border-success/30 bg-success/10 text-success active:scale-95 transition-all select-none"
                onClick={() => { setPitchCount({ ...pitchCount, balls: pitchCount.balls + 1 }); addPitch("ball"); }}
              >
                Ball
              </button>
              <button
                className="h-12 rounded-xl text-sm font-bold border-2 border-destructive/30 bg-destructive/10 text-destructive active:scale-95 transition-all select-none"
                onClick={() => { setPitchCount({ ...pitchCount, strikes: pitchCount.strikes + 1 }); addPitch("strike"); }}
              >
                Strike
              </button>
              <button
                className="h-12 rounded-xl text-sm font-bold border-2 border-border/30 text-muted-foreground active:scale-95 transition-all select-none"
                onClick={() => { setPitchCount({ ...pitchCount, strikes: pitchCount.strikes + 1 }); addPitch("foul"); }}
              >
                Foul
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="md:grid md:grid-cols-2 md:gap-4 space-y-3 md:space-y-0">
          {/* Left column: Spray chart + play log (on desktop) */}
          <div className="space-y-3">
            {/* Spray chart + hit type */}
            <Card className="glass">
              <CardContent className="px-1 pt-1 pb-3 space-y-3">
                <div className="relative flex justify-center">
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
                  {/* Clear button — upper right of spray chart */}
                  {sprayPoint && (
                    <button
                      className="absolute top-1 right-1 h-7 px-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 select-none bg-muted/30 text-muted-foreground border-border/50 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50"
                      onClick={() => { setSprayPoint(null); setHitType(null); }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {/* Hit type buttons */}
                {sprayPoint && (!selectedResult || !NON_BATTED.includes(selectedResult)) && (
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 px-1">
                    {HIT_TYPE_BUTTONS.map(({ type, label }) => (
                      <button
                        key={type}
                        className={`h-8 sm:h-10 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold border-2 transition-all active:scale-95 select-none ${
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

            {/* Play log — in left column on desktop, at the bottom on mobile */}
            <div className="hidden md:block">
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
          </div>

          {/* Right column: Now batting + pitch counter + results + RBIs + runners */}
          <div className="space-y-3">
            {/* Current batter display — desktop only (mobile shows above) */}
            {isOurBatting && batter && (
              <Card className="hidden md:block border-primary/30 bg-primary/5 animate-slide-up">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3 justify-center">
                    {batterPhotoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={batterPhotoUrl} alt="" className="h-12 w-12 rounded-full object-cover border border-primary/30 shrink-0" />
                    ) : batterPlayer ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 font-bold text-lg border border-primary/30 text-gradient-bright shrink-0">
                        {batterPlayer.number}
                      </div>
                    ) : null}
                    <div className="text-center">
                      <div className="text-xs text-gradient uppercase tracking-widest font-semibold">Now Batting</div>
                      <div className="text-2xl sm:text-xl font-extrabold mt-0.5 text-gradient-bright">{batter.playerName}</div>
                    {hitProbability !== null && (
                      <div className="mt-1 flex items-center justify-center gap-1.5">
                        <div className="h-1.5 w-20 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${hitProbability}%`,
                              backgroundColor: hitProbability >= 40 ? "var(--success)" : hitProbability >= 25 ? "var(--primary)" : "var(--destructive)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold tabular-nums" style={{
                          color: hitProbability >= 40 ? "var(--success)" : hitProbability >= 25 ? "var(--primary)" : "var(--destructive)",
                        }}>
                          {hitProbability}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">hit</span>
                      </div>
                    )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Opponent batter display — desktop only (mobile shows above) */}
            {isOpponentBatting && opponentBatter && (
              <Card className="hidden md:block border-primary/30 bg-primary/5 animate-slide-up">
                <CardContent className="p-3 sm:p-4">
                  <div className="text-center">
                    <div className="text-xs text-gradient uppercase tracking-widest font-semibold">Opponent Batting</div>
                    <div className="text-2xl sm:text-xl font-extrabold mt-0.5 text-gradient-bright">{opponentBatter.playerName}</div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Pitch counter — desktop only (mobile shows above spray chart) */}
            <Card className="glass hidden md:block">
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold tabular-nums text-gradient-bright">{pitchCount.balls}-{pitchCount.strikes}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">Count</div>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <div className="flex items-center gap-1 justify-end">
                      {Array.from({ length: Math.max(pitchCount.balls, 4) }).map((_, i) => (
                        <div key={`b-${i}`} className={`w-3 h-3 rounded-full border-2 ${i < pitchCount.balls ? "bg-success border-success" : "border-muted-foreground/30"}`} />
                      ))}
                      <span className="text-[10px] text-muted-foreground w-3">B</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      {Array.from({ length: Math.max(pitchCount.strikes, 3) }).map((_, i) => (
                        <div key={`s-${i}`} className={`w-3 h-3 rounded-full border-2 ${i < pitchCount.strikes ? "bg-destructive border-destructive" : "border-muted-foreground/30"}`} />
                      ))}
                      <span className="text-[10px] text-muted-foreground w-3">S</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    className="h-12 rounded-xl text-sm font-bold border-2 border-success/30 bg-success/10 text-success active:scale-95 transition-all select-none"
                    onClick={() => {
                      setPitchCount({ ...pitchCount, balls: pitchCount.balls + 1 }); addPitch("ball");
                    }}
                  >
                    Ball
                  </button>
                  <button
                    className="h-12 rounded-xl text-sm font-bold border-2 border-destructive/30 bg-destructive/10 text-destructive active:scale-95 transition-all select-none"
                    onClick={() => {
                      setPitchCount({ ...pitchCount, strikes: pitchCount.strikes + 1 }); addPitch("strike");
                    }}
                  >
                    Strike
                  </button>
                  <button
                    className="h-12 rounded-xl text-sm font-bold border-2 border-border/30 text-muted-foreground active:scale-95 transition-all select-none"
                    onClick={() => {
                      setPitchCount({ ...pitchCount, strikes: pitchCount.strikes + 1 }); addPitch("foul");
                    }}
                  >
                    Foul
                  </button>
                </div>
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
                        ? "border-transparent shadow-lg"
                        : "bg-muted/30 text-foreground border-border/50 hover:bg-accent hover:border-border"
                    }`}
                    style={selectedResult === result ? { background: 'var(--clay)', color: '#111111' } : undefined}
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
            <Card className="glass animate-slide-up border-orange-500/20">
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
                            ? "bg-orange-500 text-white border-transparent shadow-lg"
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
                                    ? "bg-primary text-primary-foreground border-transparent shadow-md"
                                    : to === "out"
                                      ? "bg-destructive text-white border-transparent shadow-md"
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

          </div>{/* end right column */}
        </div>
        </>
      )}

      {/* Confirm bar — fixed at bottom of screen */}
      {activeBatter && selectedResult && (
        <div className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 p-3 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] glass-strong border-t border-border/50 z-40">
          <div className="max-w-lg md:max-w-4xl mx-auto flex gap-2 items-center">
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

      {/* Play log — mobile only (desktop shows in left column) */}
      <div className="md:hidden">
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
            {/* Logo */}
            <div className="flex justify-center">
              <svg width="66" height="56" viewBox="0 0 33 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.82602 3.80953C11.9054 -1.26984 20.1407 -1.26984 25.2201 3.80953L31.3444 9.93381C32.28 10.8695 32.2801 12.3865 31.3444 13.3222L17.7173 26.9492C16.7816 27.8849 15.2646 27.8849 14.3289 26.9492L0.701741 13.3222C-0.233923 12.3865 -0.233904 10.8695 0.701741 9.93381L6.82602 3.80953ZM16.9149 3.21411C16.3178 3.15929 15.7168 3.16214 15.1202 3.22257L14.8005 3.255C13.4619 3.3906 12.1692 3.81828 11.0138 4.50791C10.5194 4.80305 10.0537 5.14404 9.62298 5.52628L9.19067 5.91001C8.90516 6.1634 9.03836 6.63444 9.41429 6.70075L14.6669 7.62732C17.3189 8.09514 19.9345 8.75021 22.4939 9.58752L27.7916 11.3205C28.0221 11.3959 28.1955 11.1072 28.0207 10.9391L22.758 5.88093L21.7436 5.103C20.3447 4.03017 18.6705 3.37528 16.9149 3.21411Z" fill="#E9D7B4"/>
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
                {(() => {
                  // After top → bottom (home bats). After bottom → top (away bats).
                  const weBatNext =
                    halfInningTransition.fromHalf === "top"
                      ? gameLocation === "home"
                      : gameLocation === "away";
                  return weBatNext ? "Switching to offense" : "Switching to defense";
                })()}
              </div>
            </div>

            {/* Tap to dismiss */}
            <div className="text-xs text-muted-foreground/50 mt-6 animate-pulse">
              Tap to continue
            </div>
          </div>

        </div>
      )}
    </div>
    </>
  );
}
