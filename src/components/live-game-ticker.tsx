"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { NavArrowUpSolid, NavArrowDownSolid } from "iconoir-react";

interface LiveGame {
  id: string;
  opponent: string;
  ourScore: number;
  opponentScore: number;
  inning: number;
  half: "top" | "bottom";
  outs: number;
  runnerFirst: boolean;
  runnerSecond: boolean;
  runnerThird: boolean;
}

/**
 * Parse a "HH:MM" game_time string into today's Date object.
 * Returns null if game_time is missing or malformed.
 */
function gameTimeToday(dateStr: string, timeStr: string | null): Date | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  // dateStr is "YYYY-MM-DD"
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Milliseconds until a given Date, floored to 0. */
function msUntil(target: Date): number {
  return Math.max(0, target.getTime() - Date.now());
}

function ScorePop({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value && ref.current) {
      ref.current.classList.remove("score-pop");
      // Force reflow to restart animation
      void ref.current.offsetWidth;
      ref.current.classList.add("score-pop");
    }
    prevRef.current = value;
  }, [value]);

  return <span ref={ref} className={className}>{value}</span>;
}

export function LiveGameTicker() {
  const { activeTeam } = useAuth();
  const [game, setGame] = useState<LiveGame | null>(null);

  useEffect(() => {
    if (!activeTeam) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clearTimer() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
    }

    function scheduleNext(fn: () => void, ms: number) {
      clearTimer();
      timer = setTimeout(fn, ms);
    }

    async function tick() {
      if (!mounted) return;
      clearTimer();

      const today = new Date().toISOString().slice(0, 10);

      // 1. Check for an in-progress game first
      const { data: liveGames } = await supabase
        .from("games")
        .select("id, opponent, our_score, opponent_score")
        .eq("team_id", activeTeam!.team_id)
        .eq("status", "in_progress")
        .limit(1);

      if (!mounted) return;

      if (liveGames && liveGames.length > 0) {
        // Live game found — fetch state and poll every 15s
        const g = liveGames[0];
        const { data: state } = await supabase
          .from("game_state")
          .select("*")
          .eq("game_id", g.id)
          .single();

        if (!mounted) return;

        if (state) {
          setGame({
            id: g.id,
            opponent: g.opponent,
            ourScore: g.our_score,
            opponentScore: g.opponent_score,
            inning: state.current_inning,
            half: state.current_half,
            outs: state.outs,
            runnerFirst: !!(state.runner_first || state.opponent_runner_first),
            runnerSecond: !!(state.runner_second || state.opponent_runner_second),
            runnerThird: !!(state.runner_third || state.opponent_runner_third),
          });
        }

        scheduleNext(tick, 15_000); // poll every 15s during a live game
        return;
      }

      // No live game — clear the ticker
      setGame(null);

      // 2. Check for a scheduled game today
      const { data: todayGames } = await supabase
        .from("games")
        .select("id, date, game_time")
        .eq("date", today)
        .eq("status", "scheduled")
        .limit(1);

      if (!mounted) return;

      if (todayGames && todayGames.length > 0) {
        const g = todayGames[0];
        const startTime = gameTimeToday(g.date, g.game_time);

        if (startTime) {
          const msToStart = msUntil(startTime);
          const THIRTY_MIN = 30 * 60 * 1000;

          if (msToStart <= 0) {
            // Game should have started — poll every 60s to catch status change
            scheduleNext(tick, 60_000);
          } else if (msToStart <= THIRTY_MIN) {
            // Within 30 min of game time — poll every 60s
            scheduleNext(tick, 60_000);
          } else {
            // Game is far out — wake up 30 min before game time
            scheduleNext(tick, msToStart - THIRTY_MIN);
          }
        } else {
          // Game today but no time set — check every 5 min
          scheduleNext(tick, 300_000);
        }
        return;
      }

      // 3. No game today — find the next upcoming game
      const { data: nextGames } = await supabase
        .from("games")
        .select("id, date, game_time")
        .gt("date", today)
        .eq("status", "scheduled")
        .order("date", { ascending: true })
        .limit(1);

      if (!mounted) return;

      if (nextGames && nextGames.length > 0) {
        const g = nextGames[0];
        const startTime = gameTimeToday(g.date, g.game_time);

        if (startTime) {
          const msToStart = msUntil(startTime);
          const THIRTY_MIN = 30 * 60 * 1000;
          const ONE_HOUR = 60 * 60 * 1000;

          if (msToStart <= THIRTY_MIN) {
            // Very close to game time on a future date — poll every 60s
            scheduleNext(tick, 60_000);
          } else if (msToStart <= ONE_HOUR) {
            // Within an hour — wake up 30 min before
            scheduleNext(tick, msToStart - THIRTY_MIN);
          } else {
            // Far away — check again in 1 hour (setTimeout max is ~24 days, so this is safe)
            scheduleNext(tick, ONE_HOUR);
          }
        } else {
          // Next game has no time — check every hour
          scheduleNext(tick, 3_600_000);
        }
      } else {
        // No scheduled games at all — check once an hour
        scheduleNext(tick, 3_600_000);
      }
    }

    tick();

    // Also refresh when tab becomes visible (returning from live scoring)
    function handleVisibility() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeTeam]);

  if (!game) return null;

  return (
    <Link
      href={`/games/${game.id}/live`}
      className="flex items-center gap-2 px-2 py-1 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all group overflow-visible"
    >
      {/* Live dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>

      {/* Score */}
      <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
        <ScorePop value={game.ourScore} className="text-foreground" />
        <span className="text-muted-foreground">-</span>
        <ScorePop value={game.opponentScore} className="text-foreground" />
      </div>

      {/* Mini diamond + inning */}
      <div className="flex items-center gap-1 overflow-visible">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" overflow="visible">
          {/* Diamond lines */}
          <line x1="12" y1="20" x2="4" y2="12" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
          <line x1="4" y1="12" x2="12" y2="4" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
          <line x1="12" y1="4" x2="20" y2="12" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
          <line x1="20" y1="12" x2="12" y2="20" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.6" />
          {/* Home plate */}
          <rect x="9.5" y="17.5" width="5" height="5" rx="0.5"
            fill="#E9D7B4"
            transform="rotate(45 12 20)" />
          {/* 3rd base */}
          <rect x="1.5" y="9.5" width="5" height="5" rx="0.5"
            fill={game.runnerThird ? "#E9D7B4" : "#111111"}
            stroke="#E9D7B4" strokeWidth="0.75"
            transform="rotate(45 4 12)" />
          {/* 2nd base */}
          <rect x="9.5" y="1.5" width="5" height="5" rx="0.5"
            fill={game.runnerSecond ? "#E9D7B4" : "#111111"}
            stroke="#E9D7B4" strokeWidth="0.75"
            transform="rotate(45 12 4)" />
          {/* 1st base */}
          <rect x="17.5" y="9.5" width="5" height="5" rx="0.5"
            fill={game.runnerFirst ? "#E9D7B4" : "#111111"}
            stroke="#E9D7B4" strokeWidth="0.75"
            transform="rotate(45 20 12)" />
        </svg>

        {/* Inning */}
        <span className="flex items-center text-xs font-bold text-muted-foreground">
          {game.half === "top"
            ? <NavArrowUpSolid width={10} height={10} />
            : <NavArrowDownSolid width={10} height={10} />
          }
          {game.inning}
        </span>

        {/* Outs */}
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < game.outs ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Opponent name (hidden on very small screens) */}
      <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[80px]">
        vs {game.opponent}
      </span>
    </Link>
  );
}
