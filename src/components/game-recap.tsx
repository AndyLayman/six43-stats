"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAvg } from "@/lib/stats/calculations";
import { fullName } from "@/lib/player-name";
import type { Player, PlateAppearance, Game } from "@/lib/scoring/types";

interface GameRecapProps {
  game: Game;
  appearances: PlateAppearance[];
  players: Player[];
}

interface PlayerGameLine {
  player: Player;
  ab: number;
  hits: number;
  rbis: number;
  hrs: number;
  avg: string;
  results: string[];
}

export function GameRecap({ game, appearances, players }: GameRecapProps) {
  const recap = useMemo(() => {
    const ourPAs = appearances.filter((pa) => pa.team === "us" && pa.player_id);

    // Per-player lines
    const byPlayer = new Map<number, PlateAppearance[]>();
    for (const pa of ourPAs) {
      const arr = byPlayer.get(pa.player_id!) ?? [];
      arr.push(pa);
      byPlayer.set(pa.player_id!, arr);
    }

    const lines: PlayerGameLine[] = [];
    for (const [pid, pas] of byPlayer) {
      const player = players.find((p) => p.id === pid);
      if (!player) continue;
      const ab = pas.filter((pa) => pa.is_at_bat).length;
      const hits = pas.filter((pa) => pa.is_hit).length;
      const rbis = pas.reduce((sum, pa) => sum + pa.rbis, 0);
      const hrs = pas.filter((pa) => pa.result === "HR").length;
      lines.push({
        player,
        ab,
        hits,
        rbis,
        hrs,
        avg: ab > 0 ? formatAvg(hits / ab) : "---",
        results: pas.map((pa) => pa.result),
      });
    }

    // Sort by hits desc, then rbis desc
    lines.sort((a, b) => b.hits - a.hits || b.rbis - a.rbis);

    // Top performers: anyone with 2+ hits OR 2+ RBIs OR a HR
    const topPerformers = lines.filter((l) => l.hits >= 2 || l.rbis >= 2 || l.hrs >= 1);

    // Team totals
    const teamAB = ourPAs.filter((pa) => pa.is_at_bat).length;
    const teamHits = ourPAs.filter((pa) => pa.is_hit).length;
    const teamHRs = ourPAs.filter((pa) => pa.result === "HR").length;
    const teamBBs = ourPAs.filter((pa) => pa.result === "BB").length;
    const teamSOs = ourPAs.filter((pa) => pa.result === "SO").length;

    // Score by inning
    const maxInning = Math.max(0, ...ourPAs.map((pa) => pa.inning));
    const theirPAs = appearances.filter((pa) => pa.team === "them");
    const maxTheirInning = Math.max(0, ...theirPAs.map((pa) => pa.inning));
    const totalInnings = Math.max(maxInning, maxTheirInning, game.innings_played || 0);

    const ourByInning: number[] = [];
    const theirByInning: number[] = [];
    for (let i = 1; i <= totalInnings; i++) {
      ourByInning.push(ourPAs.filter((pa) => pa.inning === i).reduce((s, pa) => s + pa.rbis, 0));
      theirByInning.push(theirPAs.filter((pa) => pa.inning === i).reduce((s, pa) => s + pa.rbis, 0));
    }

    const won = game.our_score > game.opponent_score;

    return { lines, topPerformers, teamAB, teamHits, teamHRs, teamBBs, teamSOs, ourByInning, theirByInning, totalInnings, won };
  }, [game, appearances, players]);

  if (recap.lines.length === 0) return null;

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-gradient flex items-center gap-2">
          Game Recap
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            recap.won ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
          }`}>
            {recap.won ? "W" : "L"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Linescore */}
        {recap.totalInnings > 0 && (
          <div className="overflow-x-auto">
            <div className="flex gap-0 text-xs tabular-nums min-w-fit">
              <div className="w-16 shrink-0 text-muted-foreground font-medium py-1" />
              {Array.from({ length: recap.totalInnings }, (_, i) => (
                <div key={i} className="w-7 text-center text-muted-foreground font-medium py-1">{i + 1}</div>
              ))}
              <div className="w-8 text-center font-bold text-muted-foreground py-1 ml-2">R</div>
              <div className="w-8 text-center font-bold text-muted-foreground py-1">H</div>
            </div>
            <div className="flex gap-0 text-xs tabular-nums border-t border-border/30 min-w-fit">
              <div className="w-16 shrink-0 font-bold py-1.5 text-primary">Padres</div>
              {recap.ourByInning.map((r, i) => (
                <div key={i} className={`w-7 text-center py-1.5 ${r > 0 ? "font-bold text-foreground" : "text-muted-foreground/50"}`}>{r}</div>
              ))}
              <div className="w-8 text-center font-bold py-1.5 ml-2">{game.our_score}</div>
              <div className="w-8 text-center font-bold py-1.5">{recap.teamHits}</div>
            </div>
            <div className="flex gap-0 text-xs tabular-nums border-t border-border/30 min-w-fit">
              <div className="w-16 shrink-0 font-bold py-1.5 text-muted-foreground truncate">{game.opponent}</div>
              {recap.theirByInning.map((r, i) => (
                <div key={i} className={`w-7 text-center py-1.5 ${r > 0 ? "font-bold text-foreground" : "text-muted-foreground/50"}`}>{r}</div>
              ))}
              <div className="w-8 text-center font-bold py-1.5 ml-2">{game.opponent_score}</div>
            </div>
          </div>
        )}

        {/* Team Stat Line */}
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: "H", value: recap.teamHits },
            { label: "HR", value: recap.teamHRs },
            { label: "BB", value: recap.teamBBs },
            { label: "SO", value: recap.teamSOs },
            { label: "AVG", value: recap.teamAB > 0 ? formatAvg(recap.teamHits / recap.teamAB) : "---" },
          ].map((s) => (
            <div key={s.label} className="py-2 rounded-lg bg-muted/30 border border-border/30">
              <div className="text-base font-bold tabular-nums">{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Top Performers */}
        {recap.topPerformers.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Top Performers</div>
            <div className="space-y-2 stagger-children">
              {recap.topPerformers.map((perf) => (
                <div
                  key={perf.player.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary shrink-0">
                      {perf.player.number}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{fullName(perf.player)}</div>
                      <div className="text-xs text-muted-foreground">
                        {perf.results.join(", ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm tabular-nums shrink-0">
                    <span className="font-bold">
                      {perf.hits}-{perf.ab}
                    </span>
                    {perf.rbis > 0 && (
                      <span className="text-primary font-semibold">{perf.rbis} RBI</span>
                    )}
                    {perf.hrs > 0 && (
                      <span className="text-primary font-semibold">{perf.hrs} HR</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
