"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { PlateAppearance, Game, Player } from "@/lib/scoring/types";
import { fullName } from "@/lib/player-name";

interface Milestone {
  emoji: string;
  text: string;
  date: string;
  playerId: number;
  color: string;
}

export function MilestoneFeed() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function compute() {
      const [pasRes, gamesRes, playersRes] = await Promise.all([
        supabase.from("plate_appearances").select("*").eq("team", "us").order("created_at"),
        supabase.from("games").select("*").eq("status", "final").order("date"),
        supabase.from("players").select("*"),
      ]);

      const pas: PlateAppearance[] = pasRes.data ?? [];
      const games: Game[] = gamesRes.data ?? [];
      const players: Player[] = playersRes.data ?? [];
      const gameMap = new Map(games.map((g) => [g.id, g]));
      const playerName = (id: number) => { const p = players.find((p) => p.id === id); return p ? fullName(p) : "Unknown"; };

      const found: Milestone[] = [];

      // Group PAs by player
      const byPlayer = new Map<number, PlateAppearance[]>();
      for (const pa of pas) {
        if (!pa.player_id) continue;
        const arr = byPlayer.get(pa.player_id) ?? [];
        arr.push(pa);
        byPlayer.set(pa.player_id, arr);
      }

      for (const [pid, playerPAs] of byPlayer) {
        const name = playerName(pid);

        // First hit of the season
        const firstHit = playerPAs.find((pa) => pa.is_hit);
        if (firstHit) {
          const game = gameMap.get(firstHit.game_id);
          found.push({
            emoji: "\u2B50",
            text: `${name} got their first hit of the season (${firstHit.result})`,
            date: game?.date ?? firstHit.created_at.slice(0, 10),
            playerId: pid,
            color: "#FFD700",
          });
        }

        // First HR
        const firstHR = playerPAs.find((pa) => pa.result === "HR");
        if (firstHR) {
          const game = gameMap.get(firstHR.game_id);
          found.push({
            emoji: "\uD83D\uDCA3",
            text: `${name} hit their first home run!`,
            date: game?.date ?? firstHR.created_at.slice(0, 10),
            playerId: pid,
            color: "#FF6161",
          });
        }

        // First stolen base
        const firstSB = playerPAs.find((pa) => pa.stolen_bases > 0);
        if (firstSB) {
          const game = gameMap.get(firstSB.game_id);
          found.push({
            emoji: "\u26A1",
            text: `${name} stole their first base`,
            date: game?.date ?? firstSB.created_at.slice(0, 10),
            playerId: pid,
            color: "#E9D7B4",
          });
        }

        // First extra-base hit (2B or 3B)
        const firstXBH = playerPAs.find((pa) => pa.result === "2B" || pa.result === "3B");
        if (firstXBH) {
          const game = gameMap.get(firstXBH.game_id);
          found.push({
            emoji: "\uD83D\uDD25",
            text: `${name} hit their first ${firstXBH.result === "2B" ? "double" : "triple"}`,
            date: game?.date ?? firstXBH.created_at.slice(0, 10),
            playerId: pid,
            color: "#f97316",
          });
        }

        // Multi-hit games
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
              found.push({
                emoji: "\uD83D\uDD25",
                text: `${name} went ${hits}-for-${gPAs.filter((pa) => pa.is_at_bat).length}!`,
                date: game?.date ?? gPAs[0].created_at.slice(0, 10),
                playerId: pid,
                color: "#574F3D",
              });
            }
          }
        }

        // Hit streak (3+ games)
        const gameIds = [...new Set(playerPAs.map((pa) => pa.game_id))];
        let bestStreak = 0;
        let currentStreak = 0;
        let streakEndGame = "";
        for (const gid of gameIds) {
          const gPAs = playerPAs.filter((pa) => pa.game_id === gid);
          const hasHit = gPAs.some((pa) => pa.is_hit);
          if (hasHit) {
            currentStreak++;
            if (currentStreak > bestStreak) {
              bestStreak = currentStreak;
              streakEndGame = gid;
            }
          } else {
            currentStreak = 0;
          }
        }
        if (bestStreak >= 3) {
          const game = gameMap.get(streakEndGame);
          found.push({
            emoji: "\uD83D\uDCAA",
            text: `${name} had a ${bestStreak}-game hit streak!`,
            date: game?.date ?? "",
            playerId: pid,
            color: "#D4C29F",
          });
        }

        // RBI milestones (5, 10, 15...)
        let totalRBI = 0;
        let lastRBIMilestone = 0;
        for (const pa of playerPAs) {
          totalRBI += pa.rbis;
          const milestone = Math.floor(totalRBI / 5) * 5;
          if (milestone > lastRBIMilestone && milestone >= 5) {
            lastRBIMilestone = milestone;
            const game = gameMap.get(pa.game_id);
            found.push({
              emoji: "\uD83C\uDFAF",
              text: `${name} reached ${milestone} RBIs on the season`,
              date: game?.date ?? pa.created_at.slice(0, 10),
              playerId: pid,
              color: "#f97316",
            });
          }
        }

        // Hit milestones (5, 10, 15...)
        let totalHits = 0;
        let lastHitMilestone = 0;
        for (const pa of playerPAs) {
          if (pa.is_hit) totalHits++;
          const milestone = Math.floor(totalHits / 5) * 5;
          if (milestone > lastHitMilestone && milestone >= 5) {
            lastHitMilestone = milestone;
            const game = gameMap.get(pa.game_id);
            found.push({
              emoji: "\uD83C\uDFB0",
              text: `${name} recorded hit #${milestone}`,
              date: game?.date ?? pa.created_at.slice(0, 10),
              playerId: pid,
              color: "#E9D7B4",
            });
          }
        }
      }

      // Sort by date descending (most recent first)
      found.sort((a, b) => b.date.localeCompare(a.date));
      setMilestones(found.slice(0, 15));
      setLoading(false);
    }
    compute();
  }, []);

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
          <span className="text-xl" style={{ filter: "grayscale(0)" }}>{m.emoji}</span>
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
