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
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="sticky left-0 z-10 bg-zinc-950 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)] text-center w-10 px-2">#</TableHead>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="text-center whitespace-nowrap">G</TableHead>
                  <TableHead className="text-center whitespace-nowrap">PA</TableHead>
                  <TableHead className="text-center whitespace-nowrap">AB</TableHead>
                  <TableHead className="text-center whitespace-nowrap">H</TableHead>
                  <TableHead className="text-center whitespace-nowrap">2B</TableHead>
                  <TableHead className="text-center whitespace-nowrap">3B</TableHead>
                  <TableHead className="text-center whitespace-nowrap">HR</TableHead>
                  <TableHead className="text-center whitespace-nowrap">RBI</TableHead>
                  <TableHead className="text-center whitespace-nowrap">BB</TableHead>
                  <TableHead className="text-center whitespace-nowrap">SO</TableHead>
                  <TableHead className="text-center whitespace-nowrap">SB</TableHead>
                  <TableHead className="text-center whitespace-nowrap">AVG</TableHead>
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
