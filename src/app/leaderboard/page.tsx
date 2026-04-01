"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAvg } from "@/lib/stats/calculations";
import type { BattingStats, FieldingStats } from "@/lib/scoring/types";

type SortKey = keyof BattingStats;

export default function LeaderboardPage() {
  const [battingStats, setBattingStats] = useState<BattingStats[]>([]);
  const [fieldingStats, setFieldingStats] = useState<FieldingStats[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("avg");
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [battingRes, fieldingRes] = await Promise.all([
        supabase.from("batting_stats_season").select("*"),
        supabase.from("fielding_stats_season").select("*"),
      ]);
      setBattingStats(battingRes.data ?? []);
      setFieldingStats(fieldingRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  }

  const sortedBatting = [...battingStats]
    .filter((s) => Number(s.at_bats) > 0)
    .sort((a, b) => {
      const aVal = Number(a[sortBy] ?? 0);
      const bVal = Number(b[sortBy] ?? 0);
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

  const sortedFielding = [...fieldingStats]
    .filter((s) => Number(s.total_chances) > 0)
    .sort((a, b) => Number(b.fielding_pct) - Number(a.fielding_pct));

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      {label} {sortBy === field ? (sortAsc ? "\u25B2" : "\u25BC") : ""}
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>

      <Tabs defaultValue="batting">
        <TabsList>
          <TabsTrigger value="batting">Batting</TabsTrigger>
          <TabsTrigger value="fielding">Fielding</TabsTrigger>
        </TabsList>

        <TabsContent value="batting">
          {sortedBatting.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No batting stats yet</p>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Player</TableHead>
                      <SortHeader label="G" field="games" />
                      <SortHeader label="AB" field="at_bats" />
                      <SortHeader label="H" field="hits" />
                      <SortHeader label="2B" field="doubles" />
                      <SortHeader label="3B" field="triples" />
                      <SortHeader label="HR" field="home_runs" />
                      <SortHeader label="RBI" field="rbis" />
                      <SortHeader label="BB" field="walks" />
                      <SortHeader label="SO" field="strikeouts" />
                      <SortHeader label="SB" field="stolen_bases" />
                      <SortHeader label="AVG" field="avg" />
                      <SortHeader label="OBP" field="obp" />
                      <SortHeader label="SLG" field="slg" />
                      <SortHeader label="OPS" field="ops" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBatting.map((stat, i) => (
                      <TableRow key={stat.player_id}>
                        <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <Link href={`/players/${stat.player_id}`} className="font-medium hover:underline">
                            {stat.player_name}
                          </Link>
                        </TableCell>
                        <TableCell>{stat.games}</TableCell>
                        <TableCell>{stat.at_bats}</TableCell>
                        <TableCell>{stat.hits}</TableCell>
                        <TableCell>{stat.doubles}</TableCell>
                        <TableCell>{stat.triples}</TableCell>
                        <TableCell>{stat.home_runs}</TableCell>
                        <TableCell>{stat.rbis}</TableCell>
                        <TableCell>{stat.walks}</TableCell>
                        <TableCell>{stat.strikeouts}</TableCell>
                        <TableCell>{stat.stolen_bases}</TableCell>
                        <TableCell className="font-bold">{formatAvg(Number(stat.avg))}</TableCell>
                        <TableCell>{formatAvg(Number(stat.obp))}</TableCell>
                        <TableCell>{formatAvg(Number(stat.slg))}</TableCell>
                        <TableCell>{formatAvg(Number(stat.ops))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fielding">
          {sortedFielding.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No fielding stats yet</p>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>G</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead>A</TableHead>
                      <TableHead>E</TableHead>
                      <TableHead>TC</TableHead>
                      <TableHead>FLD%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFielding.map((stat, i) => (
                      <TableRow key={stat.player_id}>
                        <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <Link href={`/players/${stat.player_id}`} className="font-medium hover:underline">
                            {stat.player_name}
                          </Link>
                        </TableCell>
                        <TableCell>{stat.games}</TableCell>
                        <TableCell>{stat.putouts}</TableCell>
                        <TableCell>{stat.assists}</TableCell>
                        <TableCell>{stat.errors}</TableCell>
                        <TableCell>{stat.total_chances}</TableCell>
                        <TableCell className="font-bold">{Number(stat.fielding_pct).toFixed(3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
