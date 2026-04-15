"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAvg } from "@/lib/stats/calculations";
import { fullName } from "@/lib/player-name";
import type { Player } from "@/lib/scoring/types";

interface PlayerWithStats extends Player {
  games: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  home_runs: number;
  rbis: number;
  walks: number;
  strikeouts: number;
  stolen_bases: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

interface PlayerCompareProps {
  open: boolean;
  onClose: () => void;
  players: PlayerWithStats[];
}

interface CompStat {
  label: string;
  key: keyof PlayerWithStats;
  format?: (v: number) => string;
  higherIsBetter: boolean;
}

const COMP_STATS: CompStat[] = [
  { label: "AVG", key: "avg", format: (v) => formatAvg(v), higherIsBetter: true },
  { label: "OBP", key: "obp", format: (v) => formatAvg(v), higherIsBetter: true },
  { label: "SLG", key: "slg", format: (v) => formatAvg(v), higherIsBetter: true },
  { label: "OPS", key: "ops", format: (v) => formatAvg(v), higherIsBetter: true },
  { label: "Hits", key: "hits", higherIsBetter: true },
  { label: "HR", key: "home_runs", higherIsBetter: true },
  { label: "RBI", key: "rbis", higherIsBetter: true },
  { label: "BB", key: "walks", higherIsBetter: true },
  { label: "SO", key: "strikeouts", higherIsBetter: false },
  { label: "SB", key: "stolen_bases", higherIsBetter: true },
  { label: "Games", key: "games", higherIsBetter: true },
];

export function PlayerCompare({ open, onClose, players }: PlayerCompareProps) {
  const eligible = useMemo(() => players.filter((p) => p.at_bats > 0), [players]);
  const [playerA, setPlayerA] = useState<number | null>(null);
  const [playerB, setPlayerB] = useState<number | null>(null);

  const a = eligible.find((p) => p.id === playerA) ?? null;
  const b = eligible.find((p) => p.id === playerB) ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gradient text-xl">Compare Players</DialogTitle>
        </DialogHeader>

        {/* Player selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5 block">Player 1</label>
            <select
              value={playerA ?? ""}
              onChange={(e) => setPlayerA(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-10 rounded-xl border border-border/50 bg-muted/30 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Select...</option>
              {eligible.filter((p) => p.id !== playerB).map((p) => (
                <option key={p.id} value={p.id}>#{p.number} {fullName(p)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5 block">Player 2</label>
            <select
              value={playerB ?? ""}
              onChange={(e) => setPlayerB(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-10 rounded-xl border border-border/50 bg-muted/30 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Select...</option>
              {eligible.filter((p) => p.id !== playerA).map((p) => (
                <option key={p.id} value={p.id}>#{p.number} {fullName(p)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison bars */}
        {a && b ? (
          <div className="space-y-3 mt-2">
            {/* Player headers */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <div className="text-right">
                <div className="font-bold text-sm">{fullName(a)}</div>
                <div className="text-xs text-muted-foreground">#{a.number}</div>
              </div>
              <div className="text-xs text-muted-foreground font-medium px-2">vs</div>
              <div>
                <div className="font-bold text-sm">{fullName(b)}</div>
                <div className="text-xs text-muted-foreground">#{b.number}</div>
              </div>
            </div>

            {/* Stat bars */}
            {COMP_STATS.map((stat) => {
              const valA = Number(a[stat.key]);
              const valB = Number(b[stat.key]);
              const max = Math.max(valA, valB, 0.001);
              const pctA = (valA / max) * 100;
              const pctB = (valB / max) * 100;
              const aWins = stat.higherIsBetter ? valA > valB : valA < valB;
              const bWins = stat.higherIsBetter ? valB > valA : valB < valA;
              const format = stat.format ?? ((v: number) => String(v));

              return (
                <div key={stat.key} className="space-y-1">
                  <div className="text-[10px] text-center text-muted-foreground uppercase tracking-wider font-medium">
                    {stat.label}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    {/* Player A bar (right-aligned) */}
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs font-bold tabular-nums ${aWins ? "text-primary" : "text-muted-foreground"}`}>
                        {format(valA)}
                      </span>
                      <div className="w-24 h-3 rounded-full bg-border/20 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${aWins ? "bg-primary" : "bg-muted-foreground/30"}`}
                          style={{ width: `${pctA}%`, float: "right" }}
                        />
                      </div>
                    </div>
                    <div className="w-0" />
                    {/* Player B bar (left-aligned) */}
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-3 rounded-full bg-border/20 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${bWins ? "bg-primary" : "bg-muted-foreground/30"}`}
                          style={{ width: `${pctB}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${bWins ? "text-primary" : "text-muted-foreground"}`}>
                        {format(valB)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-8">
            Select two players to compare their stats
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
