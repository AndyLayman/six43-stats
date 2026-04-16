"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { cachedQuery } from "@/lib/query-cache";
import { useAuth } from "@/components/auth-provider";
import type { PlateAppearance, Game, Player } from "@/lib/scoring/types";
import { fullName } from "@/lib/player-name";
import { Star, Bonfire, Flash, FireFlame, Running, Archery, Medal } from "iconoir-react";
import type { ComponentType, SVGProps } from "react";

export interface Milestone {
  icon: ComponentType<SVGProps<SVGSVGElement> & { width?: number; height?: number }>;
  text: string;
  date: string;
  playerId: number;
}

/** Compute milestones for a single player given their PAs and a game lookup map. */
export function computePlayerMilestones(
  pid: number,
  name: string,
  playerPAs: PlateAppearance[],
  gameMap: Map<string, Game>,
): Milestone[] {
  const found: Milestone[] = [];

  const firstHit = playerPAs.find((pa) => pa.is_hit);
  if (firstHit) {
    const game = gameMap.get(firstHit.game_id);
    found.push({ icon: Star, text: `First hit of the season (${firstHit.result})`, date: game?.date ?? firstHit.created_at.slice(0, 10), playerId: pid });
  }

  const firstHR = playerPAs.find((pa) => pa.result === "HR");
  if (firstHR) {
    const game = gameMap.get(firstHR.game_id);
    found.push({ icon: Bonfire, text: `Hit their first home run!`, date: game?.date ?? firstHR.created_at.slice(0, 10), playerId: pid });
  }

  const firstSB = playerPAs.find((pa) => pa.stolen_bases > 0);
  if (firstSB) {
    const game = gameMap.get(firstSB.game_id);
    found.push({ icon: Flash, text: `Stole their first base`, date: game?.date ?? firstSB.created_at.slice(0, 10), playerId: pid });
  }

  const firstXBH = playerPAs.find((pa) => pa.result === "2B" || pa.result === "3B");
  if (firstXBH) {
    const game = gameMap.get(firstXBH.game_id);
    found.push({ icon: FireFlame, text: `Hit their first ${firstXBH.result === "2B" ? "double" : "triple"}`, date: game?.date ?? firstXBH.created_at.slice(0, 10), playerId: pid });
  }

  const gameGroups = new Map<string, PlateAppearance[]>();
  for (const pa of playerPAs) {
    const arr = gameGroups.get(pa.game_id) ?? [];
    arr.push(pa);
    gameGroups.set(pa.game_id, arr);
  }
  let multiHitCount = 0;
  for (const [gid, gPAs] of gameGroups) {
    const hits = gPAs.filter((pa) => pa.is_hit).length;
    if (hits >= 3) {
      multiHitCount++;
      if (multiHitCount <= 2) {
        const game = gameMap.get(gid);
        found.push({ icon: FireFlame, text: `Went ${hits}-for-${gPAs.filter((pa) => pa.is_at_bat).length}!`, date: game?.date ?? gPAs[0].created_at.slice(0, 10), playerId: pid });
      }
    }
  }

  const gameIds = [...new Set(playerPAs.map((pa) => pa.game_id))];
  let bestStreak = 0, currentStreak = 0, streakEndGame = "";
  for (const gid of gameIds) {
    const gPAs = playerPAs.filter((pa) => pa.game_id === gid);
    if (gPAs.some((pa) => pa.is_hit)) { currentStreak++; if (currentStreak > bestStreak) { bestStreak = currentStreak; streakEndGame = gid; } } else { currentStreak = 0; }
  }
  if (bestStreak >= 3) {
    const game = gameMap.get(streakEndGame);
    found.push({ icon: Running, text: `Had a ${bestStreak}-game hit streak!`, date: game?.date ?? "", playerId: pid });
  }

  let totalRBI = 0, lastRBIMilestone = 0;
  for (const pa of playerPAs) {
    totalRBI += pa.rbis;
    const milestone = Math.floor(totalRBI / 5) * 5;
    if (milestone > lastRBIMilestone && milestone >= 5) {
      lastRBIMilestone = milestone;
      const game = gameMap.get(pa.game_id);
      found.push({ icon: Archery, text: `Reached ${milestone} RBIs on the season`, date: game?.date ?? pa.created_at.slice(0, 10), playerId: pid });
    }
  }

  let totalHits = 0, lastHitMilestone = 0;
  for (const pa of playerPAs) {
    if (pa.is_hit) totalHits++;
    const milestone = Math.floor(totalHits / 5) * 5;
    if (milestone > lastHitMilestone && milestone >= 5) {
      lastHitMilestone = milestone;
      const game = gameMap.get(pa.game_id);
      found.push({ icon: Medal, text: `Recorded hit #${milestone}`, date: game?.date ?? pa.created_at.slice(0, 10), playerId: pid });
    }
  }

  found.sort((a, b) => b.date.localeCompare(a.date));
  return found;
}

export function MilestoneFeed() {
  const { activeTeam } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTeam) return;
    async function compute() {
      // Use cachedQuery so we share data with the dashboard (players, games)
      const [pasRes, gamesRes, playersRes] = await Promise.all([
        cachedQuery<PlateAppearance[]>("plate_appearances:us", () =>
          supabase.from("plate_appearances").select("*").eq("team", "us").order("created_at")
        ),
        cachedQuery<Game[]>("games:all", () =>
          supabase.from("games").select("*").eq("team_id", activeTeam!.team_id)
        ),
        cachedQuery<Player[]>("players", () =>
          supabase.from("players").select("*").eq("team_id", activeTeam!.team_id)
        ),
      ]);

      const pas: PlateAppearance[] = pasRes.data ?? [];
      const games: Game[] = (gamesRes.data ?? []).filter((g) => g.status === "final");
      const players: Player[] = playersRes.data ?? [];
      const gameMap = new Map(games.map((g) => [g.id, g]));
      const playerName = (id: number) => { const p = players.find((p) => p.id === id); return p ? fullName(p) : "Unknown"; };

      // Group PAs by player
      const byPlayer = new Map<number, PlateAppearance[]>();
      for (const pa of pas) {
        if (!pa.player_id) continue;
        const arr = byPlayer.get(pa.player_id) ?? [];
        arr.push(pa);
        byPlayer.set(pa.player_id, arr);
      }

      const found: Milestone[] = [];
      for (const [pid, playerPAs] of byPlayer) {
        const name = playerName(pid);
        const playerMs = computePlayerMilestones(pid, name, playerPAs, gameMap);
        // Prefix player name to text for the team-wide feed
        found.push(...playerMs.map(m => ({ ...m, text: `${name} — ${m.text}` })));
      }

      found.sort((a, b) => b.date.localeCompare(a.date));
      setMilestones(found.slice(0, 15));
      setLoading(false);
    }
    compute();
  }, [activeTeam]);

  if (loading) return null;
  if (milestones.length === 0) return null;

  return (
    <div className="space-y-2 stagger-children">
      {milestones.map((m, i) => (
        <Link
          key={i}
          href={`/players/${m.playerId}`}
          className="flex items-center gap-3 rounded-xl border border-border/50 p-3 hover:bg-accent hover:border-primary/20 transition-all group"
        >
          <m.icon width={20} height={20} className="shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium group-hover:text-primary transition-colors">{m.text}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(m.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
