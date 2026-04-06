"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAvg } from "@/lib/stats/calculations";
import type { BattingStats, FieldingStats } from "@/lib/scoring/types";
import { StatTip } from "@/components/stat-tip";

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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer hover:text-primary transition-colors select-none px-2 py-3"
      onClick={() => handleSort(field)}
    >
      <StatTip label={label}>{label} {sortBy === field ? (sortAsc ? "\u25B2" : "\u25BC") : ""}</StatTip>
    </TableHead>
  );

  const SORT_OPTIONS: { label: string; field: SortKey }[] = [
    { label: "AVG", field: "avg" },
    { label: "H", field: "hits" },
    { label: "HR", field: "home_runs" },
    { label: "RBI", field: "rbis" },
    { label: "OPS", field: "ops" },
    { label: "SB", field: "stolen_bases" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-gradient">Leaderboard</h1>

      <Tabs defaultValue="batting">
        <TabsList className="w-full sm:w-auto bg-muted/50">
          <TabsTrigger value="batting" className="flex-1 sm:flex-none">Batting</TabsTrigger>
          <TabsTrigger value="fielding" className="flex-1 sm:flex-none">Fielding</TabsTrigger>
        </TabsList>

        <TabsContent value="batting">
          {sortedBatting.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No batting stats yet</p>
          ) : (
            <>
              {/* Mobile: sort chips + card list */}
              <div className="sm:hidden space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.field}
                      onClick={() => handleSort(opt.field)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                        sortBy === opt.field
                          ? "bg-primary text-primary-foreground border-primary glow-primary"
                          : "bg-muted/30 border-border/50 text-muted-foreground"
                      }`}
                    >
                      {opt.label} {sortBy === opt.field ? (sortAsc ? "\u25B2" : "\u25BC") : ""}
                    </button>
                  ))}
                </div>
                <div className="stagger-children">
                  {sortedBatting.map((stat, i) => (
                    <Link key={stat.player_id} href={`/players/${stat.player_id}`}>
                      <Card className="card-hover glass mb-3">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold w-5 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                                {i + 1}
                              </span>
                              <span className="font-semibold">{stat.player_name}</span>
                            </div>
                            <span className="text-lg font-extrabold tabular-nums text-gradient-bright">
                              {sortBy === "avg" || sortBy === "obp" || sortBy === "slg" || sortBy === "ops"
                                ? formatAvg(Number(stat[sortBy]))
                                : String(stat[sortBy])}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {[
                              { label: "AVG", value: formatAvg(Number(stat.avg)) },
                              { label: "H", value: stat.hits },
                              { label: "HR", value: stat.home_runs },
                              { label: "RBI", value: stat.rbis },
                            ].map((s) => (
                              <div key={s.label} className="text-xs">
                                <div className="font-bold tabular-nums">{s.value}</div>
                                <div className="text-muted-foreground uppercase tracking-wider"><StatTip label={s.label} /></div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Desktop: full table */}
              <Card className="hidden sm:block glass">
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
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
                        <TableRow key={stat.player_id} className="border-border/30">
                          <TableCell className={`font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {i + 1}
                          </TableCell>
                          <TableCell>
                            <Link href={`/players/${stat.player_id}`} className="font-medium hover:text-primary transition-colors">
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
                          <TableCell className="font-bold text-gradient-bright">{formatAvg(Number(stat.avg))}</TableCell>
                          <TableCell>{formatAvg(Number(stat.obp))}</TableCell>
                          <TableCell>{formatAvg(Number(stat.slg))}</TableCell>
                          <TableCell>{formatAvg(Number(stat.ops))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="fielding">
          {sortedFielding.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No fielding stats yet</p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-3 stagger-children">
                {sortedFielding.map((stat, i) => (
                  <Link key={stat.player_id} href={`/players/${stat.player_id}`}>
                    <Card className="card-hover glass">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold w-5 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                              {i + 1}
                            </span>
                            <span className="font-semibold">{stat.player_name}</span>
                          </div>
                          <span className="text-lg font-extrabold tabular-nums text-gradient-bright">
                            {Number(stat.fielding_pct).toFixed(3)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div><div className="font-bold">{stat.putouts}</div><div className="text-muted-foreground">PO</div></div>
                          <div><div className="font-bold">{stat.assists}</div><div className="text-muted-foreground">A</div></div>
                          <div><div className="font-bold">{stat.errors}</div><div className="text-muted-foreground">E</div></div>
                          <div><div className="font-bold">{stat.total_chances}</div><div className="text-muted-foreground">TC</div></div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Desktop: table */}
              <Card className="hidden sm:block glass">
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead><StatTip label="G" /></TableHead>
                        <TableHead><StatTip label="PO" /></TableHead>
                        <TableHead><StatTip label="A" /></TableHead>
                        <TableHead><StatTip label="E" /></TableHead>
                        <TableHead><StatTip label="TC" /></TableHead>
                        <TableHead><StatTip label="FLD%" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedFielding.map((stat, i) => (
                        <TableRow key={stat.player_id} className="border-border/30">
                          <TableCell className={`font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {i + 1}
                          </TableCell>
                          <TableCell>
                            <Link href={`/players/${stat.player_id}`} className="font-medium hover:text-primary transition-colors">
                              {stat.player_name}
                            </Link>
                          </TableCell>
                          <TableCell>{stat.games}</TableCell>
                          <TableCell>{stat.putouts}</TableCell>
                          <TableCell>{stat.assists}</TableCell>
                          <TableCell>{stat.errors}</TableCell>
                          <TableCell>{stat.total_chances}</TableCell>
                          <TableCell className="font-bold text-gradient-bright">{Number(stat.fielding_pct).toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
