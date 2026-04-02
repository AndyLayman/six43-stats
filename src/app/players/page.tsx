"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAvg } from "@/lib/stats/calculations";
import type { Player } from "@/lib/scoring/types";

interface PlayerWithStats extends Player {
  games: number;
  plate_appearances: number;
  at_bats: number;
  hits: number;
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

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-gradient">Players</h1>

      <Card className="glass border-border/50">
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-gradient">Season Stats</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {/* Mobile: card list */}
          <div className="space-y-3 px-3 sm:hidden">
            {players.map((p) => (
              <Link key={p.id} href={`/players/${p.id}`} className="block">
                <div className="rounded-xl border border-border/50 p-3 active:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-bold text-sm border border-primary/30 text-gradient-bright">
                      {p.number}
                    </div>
                    <span className="font-semibold text-primary">{p.name}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "AVG", value: p.at_bats > 0 ? formatAvg(p.avg) : "---" },
                      { label: "H", value: p.hits },
                      { label: "HR", value: p.home_runs },
                      { label: "RBI", value: p.rbis },
                      { label: "OBP", value: p.at_bats > 0 ? formatAvg(p.obp) : "---" },
                      { label: "SLG", value: p.at_bats > 0 ? formatAvg(p.slg) : "---" },
                      { label: "BB", value: p.walks },
                      { label: "SO", value: p.strikeouts },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-muted/30 border border-border/30 py-1">
                        <div className="text-sm font-bold tabular-nums">{s.value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="sticky left-0 bg-card z-10">Player</TableHead>
                  <TableHead className="text-center">G</TableHead>
                  <TableHead className="text-center">PA</TableHead>
                  <TableHead className="text-center">AB</TableHead>
                  <TableHead className="text-center">H</TableHead>
                  <TableHead className="text-center">2B</TableHead>
                  <TableHead className="text-center">3B</TableHead>
                  <TableHead className="text-center">HR</TableHead>
                  <TableHead className="text-center">RBI</TableHead>
                  <TableHead className="text-center">BB</TableHead>
                  <TableHead className="text-center">SO</TableHead>
                  <TableHead className="text-center">SB</TableHead>
                  <TableHead className="text-center">AVG</TableHead>
                  <TableHead className="text-center">OBP</TableHead>
                  <TableHead className="text-center">SLG</TableHead>
                  <TableHead className="text-center">OPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((p) => (
                  <TableRow key={p.id} className="border-border/30 hover:bg-accent/30 transition-colors">
                    <TableCell className="sticky left-0 bg-card z-10 font-medium">
                      <Link href={`/players/${p.id}`} className="text-primary hover:underline">
                        #{p.number} {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{p.games}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.plate_appearances}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.at_bats}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.hits}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.doubles}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.triples}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.home_runs}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.rbis}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.walks}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.strikeouts}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.stolen_bases}</TableCell>
                    <TableCell className="text-center tabular-nums font-bold text-primary">
                      {p.at_bats > 0 ? formatAvg(p.avg) : "---"}
                    </TableCell>
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
