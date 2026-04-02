"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAvg } from "@/lib/stats/calculations";
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

// Generate an optimized batting order based on classic baseball strategy:
// 1 - Leadoff: high OBP + speed
// 2 - Contact/table-setter: high AVG + OBP, can move runners
// 3 - Best overall hitter: highest OPS
// 4 - Cleanup: power + RBI (SLG heavy)
// 5 - Secondary power
// 6-9 - Remaining by OPS descending
function generateOptimizedOrder(players: PlayerWithStats[]): PlayerWithStats[] {
  const eligible = players.filter((p) => p.at_bats > 0);
  if (eligible.length === 0) return [];

  const remaining = [...eligible];
  const order: PlayerWithStats[] = [];

  function pickBest(scoreFn: (p: PlayerWithStats) => number): PlayerWithStats {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const score = scoreFn(remaining[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return remaining.splice(bestIdx, 1)[0];
  }

  // 1 - Leadoff: OBP + speed
  order.push(pickBest((p) => p.obp * 0.6 + (p.stolen_bases / Math.max(p.games, 1)) * 0.4));

  if (remaining.length === 0) return order;

  // 3 - Best overall hitter (pick before 2 so we get the true best)
  const thirdHitter = pickBest((p) => p.ops);

  if (remaining.length === 0) {
    order.push(thirdHitter);
    return order;
  }

  // 4 - Cleanup: power + RBI
  const cleanupHitter = pickBest((p) => p.slg * 0.5 + (p.rbis / Math.max(p.games, 1)) * 0.3 + (p.home_runs / Math.max(p.games, 1)) * 0.2);

  if (remaining.length === 0) {
    order.push(thirdHitter, cleanupHitter);
    return order;
  }

  // 2 - Contact/table-setter: AVG + OBP
  order.push(pickBest((p) => p.avg * 0.5 + p.obp * 0.5));

  // Now insert 3 and 4
  order.push(thirdHitter, cleanupHitter);

  if (remaining.length === 0) return order;

  // 5 - Secondary power
  order.push(pickBest((p) => p.slg * 0.6 + p.ops * 0.4));

  // 6-9+ - Remaining by OPS
  remaining.sort((a, b) => b.ops - a.ops);
  order.push(...remaining);

  return order;
}

const SLOT_LABELS = [
  "Leadoff — Gets on base, has speed",
  "Table-setter — Good contact, moves runners",
  "Best hitter — Highest overall production",
  "Cleanup — Power & RBI",
  "Secondary power",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
];

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrder, setShowOrder] = useState(false);

  useEffect(() => {
    async function load() {
      const [playersRes, statsRes] = await Promise.all([
        supabase.from("players").select("*"),
        supabase.from("batting_stats_season").select("*"),
      ]);

      const allPlayers: Player[] = playersRes.data ?? [];
      const allStats = statsRes.data ?? [];

      const merged: PlayerWithStats[] = allPlayers.map((p) => {
        const s = allStats.find((st) => st.player_id === p.id);
        return {
          ...p,
          games: s ? Number(s.games) : 0,
          plate_appearances: s ? Number(s.plate_appearances) : 0,
          at_bats: s ? Number(s.at_bats) : 0,
          hits: s ? Number(s.hits) : 0,
          singles: s ? Number(s.singles) : 0,
          doubles: s ? Number(s.doubles) : 0,
          triples: s ? Number(s.triples) : 0,
          home_runs: s ? Number(s.home_runs) : 0,
          rbis: s ? Number(s.rbis) : 0,
          walks: s ? Number(s.walks) : 0,
          strikeouts: s ? Number(s.strikeouts) : 0,
          stolen_bases: s ? Number(s.stolen_bases) : 0,
          avg: s ? Number(s.avg) : 0,
          obp: s ? Number(s.obp) : 0,
          slg: s ? Number(s.slg) : 0,
          ops: s ? Number(s.ops) : 0,
        };
      });

      merged.sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(merged);
      setLoading(false);
    }
    load();
  }, []);

  const optimizedOrder = useMemo(() => generateOptimizedOrder(players), [players]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-gradient">Players</h1>
        <Button
          onClick={() => setShowOrder(true)}
          className="bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 text-white font-semibold"
        >
          Optimized Order
        </Button>
      </div>

      <Dialog open={showOrder} onOpenChange={setShowOrder}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">Optimized Batting Order</DialogTitle>
          </DialogHeader>
          {optimizedOrder.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Not enough stats to generate an order yet.</p>
          ) : (
            <div className="space-y-2">
              {optimizedOrder.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-purple-500 font-bold text-white text-sm shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      <span className="text-muted-foreground mr-1">#{p.number}</span>
                      {p.name}
                    </div>
                    {SLOT_LABELS[i] && (
                      <div className="text-xs text-muted-foreground">{SLOT_LABELS[i]}</div>
                    )}
                    <div className="flex gap-3 mt-1 text-xs tabular-nums text-muted-foreground">
                      <span>AVG {formatAvg(p.avg)}</span>
                      <span>OBP {formatAvg(p.obp)}</span>
                      <span>SLG {formatAvg(p.slg)}</span>
                      <span>HR {p.home_runs}</span>
                      <span>SB {p.stolen_bases}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="glass border-border/50">
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-gradient">Season Stats</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="sticky left-0 z-10 bg-zinc-950 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)] text-center w-10 px-2">#</TableHead>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="text-center whitespace-nowrap">AVG</TableHead>
                  <TableHead className="text-center whitespace-nowrap">G</TableHead>
                  <TableHead className="text-center whitespace-nowrap">PA</TableHead>
                  <TableHead className="text-center whitespace-nowrap">AB</TableHead>
                  <TableHead className="text-center whitespace-nowrap">H</TableHead>
                  <TableHead className="text-center whitespace-nowrap">1B</TableHead>
                  <TableHead className="text-center whitespace-nowrap">2B</TableHead>
                  <TableHead className="text-center whitespace-nowrap">3B</TableHead>
                  <TableHead className="text-center whitespace-nowrap">HR</TableHead>
                  <TableHead className="text-center whitespace-nowrap">RBI</TableHead>
                  <TableHead className="text-center whitespace-nowrap">BB</TableHead>
                  <TableHead className="text-center whitespace-nowrap">SO</TableHead>
                  <TableHead className="text-center whitespace-nowrap">SB</TableHead>
                  <TableHead className="text-center whitespace-nowrap">OBP</TableHead>
                  <TableHead className="text-center whitespace-nowrap">SLG</TableHead>
                  <TableHead className="text-center whitespace-nowrap">OPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((p) => (
                  <TableRow key={p.id} className="border-border/30 hover:bg-accent/30 transition-colors">
                    <TableCell className="sticky left-0 z-10 bg-zinc-950 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)] text-center w-10 px-2 font-bold tabular-nums">
                      {p.number}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link href={`/players/${p.id}`} className="text-primary hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center tabular-nums font-bold text-primary">
                      {p.at_bats > 0 ? formatAvg(p.avg) : "---"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{p.games}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.plate_appearances}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.at_bats}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.hits}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.singles}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.doubles}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.triples}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.home_runs}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.rbis}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.walks}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.strikeouts}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.stolen_bases}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {p.at_bats > 0 ? formatAvg(p.obp) : "---"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {p.at_bats > 0 ? formatAvg(p.slg) : "---"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {p.at_bats > 0 ? formatAvg(p.ops) : "---"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
