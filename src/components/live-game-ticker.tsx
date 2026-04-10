"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
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

export function LiveGameTicker() {
  const [game, setGame] = useState<LiveGame | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchLiveGame() {
      // Find an in-progress game
      const { data: games } = await supabase
        .from("games")
        .select("id, opponent, our_score, opponent_score")
        .eq("status", "in_progress")
        .limit(1);

      if (!mounted || !games || games.length === 0) {
        if (mounted) setGame(null);
        return;
      }

      const g = games[0];

      // Fetch game state
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
    }

    fetchLiveGame();
    // Poll every 10 seconds for live updates
    const interval = setInterval(fetchLiveGame, 10000);
    // Also refresh when tab becomes visible (returning from live scoring)
    function handleVisibility() {
      if (document.visibilityState === "visible") fetchLiveGame();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

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
        <span className="text-foreground">{game.ourScore}</span>
        <span className="text-muted-foreground">-</span>
        <span className="text-foreground">{game.opponentScore}</span>
      </div>

      {/* Mini diamond + inning */}
      <div className="flex items-center gap-1 overflow-visible">
        <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" overflow="visible">
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
