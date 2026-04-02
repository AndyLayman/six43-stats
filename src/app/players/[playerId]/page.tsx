"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAvg } from "@/lib/stats/calculations";
import { SprayChart } from "@/components/scoring/SprayChart";
import type { Player, PlateAppearance, PlateAppearanceResult, BattingStats, FieldingStats, HitType } from "@/lib/scoring/types";

type SprayFilter = "both" | "hits" | "outs";

export default function PlayerDetailPage() {
  const params = useParams();
  const playerId = Number(params.playerId);
  const [player, setPlayer] = useState<Player | null>(null);
  const [battingStats, setBattingStats] = useState<BattingStats | null>(null);
  const [fieldingStats, setFieldingStats] = useState<FieldingStats | null>(null);
  const [allPAs, setAllPAs] = useState<PlateAppearance[]>([]);
  const [gameLog, setGameLog] = useState<{ game_id: string; date: string; opponent: string; appearances: PlateAppearance[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sprayFilter, setSprayFilter] = useState<SprayFilter>("both");

  useEffect(() => {
    async function load() {
      const [playerRes, battingRes, fieldingRes, pasRes, gamesRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", playerId).single(),
        supabase.from("batting_stats_season").select("*").eq("player_id", playerId).single(),
        supabase.from("fielding_stats_season").select("*").eq("player_id", playerId).single(),
        supabase.from("plate_appearances").select("*").eq("player_id", playerId).order("created_at"),
        supabase.from("games").select("*").eq("status", "final").order("date", { ascending: false }),
      ]);

      setPlayer(playerRes.data);
      setBattingStats(battingRes.data);
      setFieldingStats(fieldingRes.data);

      const games = gamesRes.data ?? [];
      const pas: PlateAppearance[] = pasRes.data ?? [];
      setAllPAs(pas);
      const log = games
        .filter((g) => pas.some((pa) => pa.game_id === g.id))
        .map((g) => ({
          game_id: g.id,
          date: g.date,
          opponent: g.opponent,
          appearances: pas.filter((pa) => pa.game_id === g.id),
        }));
      setGameLog(log);
      setLoading(false);
    }
    load();
  }, [playerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!player) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Player not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 font-bold text-2xl border border-primary/30 text-gradient-bright">
          {player.number}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">{player.name}</h1>
          <p className="text-muted-foreground">#{player.number}</p>
        </div>
      </div>

      {/* Season stat highlights */}
      {battingStats && Number(battingStats.at_bats) > 0 && (
        <div className="grid gap-3 grid-cols-3 md:grid-cols-6 stagger-children">
          {[
            { label: "AVG", value: formatAvg(Number(battingStats.avg)) },
            { label: "OBP", value: formatAvg(Number(battingStats.obp)) },
            { label: "SLG", value: formatAvg(Number(battingStats.slg)) },
            { label: "OPS", value: formatAvg(Number(battingStats.ops)) },
            { label: "HR", value: String(battingStats.home_runs) },
            { label: "RBI", value: String(battingStats.rbis) },
          ].map((s) => (
            <Card key={s.label} className="glass gradient-border card-hover">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-extrabold tabular-nums text-gradient-bright">{s.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Spray Chart */}
      {(() => {
        const sprayPAs = allPAs.filter((pa) => pa.spray_x != null && pa.spray_y != null);
        if (sprayPAs.length === 0) return null;

        const filtered = sprayPAs.filter((pa) => {
          if (sprayFilter === "hits") return pa.is_hit;
          if (sprayFilter === "outs") return !pa.is_hit;
          return true;
        });

        const ghostMarkers = filtered.map((pa) => ({
          x: pa.spray_x!,
          y: pa.spray_y!,
          result: pa.result as PlateAppearanceResult,
          hitType: pa.hit_type as HitType | null,
        }));

        return (
          <Card className="glass border-border/50">
            <CardHeader className="px-3 sm:px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-gradient">Spray Chart</CardTitle>
              <div className="flex rounded-lg overflow-hidden border border-border/50">
                {([
                  { value: "both", label: "Both" },
                  { value: "hits", label: "Hits" },
                  { value: "outs", label: "Outs" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSprayFilter(opt.value)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      sprayFilter === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-1 pt-1 pb-3">
              <div className="max-w-md mx-auto">
                <SprayChart ghostMarkers={ghostMarkers} interactive={false} />
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Tabs defaultValue="batting">
        <TabsList className="w-full sm:w-auto bg-muted/50">
          <TabsTrigger value="batting" className="flex-1 sm:flex-none">Batting</TabsTrigger>
          <TabsTrigger value="fielding" className="flex-1 sm:flex-none">Fielding</TabsTrigger>
          <TabsTrigger value="gamelog" className="flex-1 sm:flex-none">Game Log</TabsTrigger>
        </TabsList>

        <TabsContent value="batting">
          {battingStats && Number(battingStats.at_bats) > 0 ? (
            <Card className="glass border-border/50">
              <CardHeader className="px-3 sm:px-6">
                <CardTitle className="text-gradient">Season Batting Stats</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {/* Mobile: stat grid */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:hidden">
                  {[
                    { label: "G", value: battingStats.games },
                    { label: "AB", value: battingStats.at_bats },
                    { label: "H", value: battingStats.hits },
                    { label: "2B", value: battingStats.doubles },
                    { label: "3B", value: battingStats.triples },
                    { label: "HR", value: battingStats.home_runs },
                    { label: "RBI", value: battingStats.rbis },
                    { label: "BB", value: battingStats.walks },
                    { label: "SO", value: battingStats.strikeouts },
                    { label: "SB", value: battingStats.stolen_bases },
                    { label: "AVG", value: formatAvg(Number(battingStats.avg)) },
                    { label: "OBP", value: formatAvg(Number(battingStats.obp)) },
                    { label: "SLG", value: formatAvg(Number(battingStats.slg)) },
                    { label: "OPS", value: formatAvg(Number(battingStats.ops)) },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="text-lg font-bold tabular-nums">{s.value}</div>
                      <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>G</TableHead>
                        <TableHead>PA</TableHead>
                        <TableHead>AB</TableHead>
                        <TableHead>H</TableHead>
                        <TableHead>2B</TableHead>
                        <TableHead>3B</TableHead>
                        <TableHead>HR</TableHead>
                        <TableHead>RBI</TableHead>
                        <TableHead>BB</TableHead>
                        <TableHead>SO</TableHead>
                        <TableHead>SB</TableHead>
                        <TableHead>AVG</TableHead>
                        <TableHead>OBP</TableHead>
                        <TableHead>SLG</TableHead>
                        <TableHead>OPS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-border/30">
                        <TableCell>{battingStats.games}</TableCell>
                        <TableCell>{battingStats.plate_appearances}</TableCell>
                        <TableCell>{battingStats.at_bats}</TableCell>
                        <TableCell>{battingStats.hits}</TableCell>
                        <TableCell>{battingStats.doubles}</TableCell>
                        <TableCell>{battingStats.triples}</TableCell>
                        <TableCell>{battingStats.home_runs}</TableCell>
                        <TableCell>{battingStats.rbis}</TableCell>
                        <TableCell>{battingStats.walks}</TableCell>
                        <TableCell>{battingStats.strikeouts}</TableCell>
                        <TableCell>{battingStats.stolen_bases}</TableCell>
                        <TableCell className="font-bold text-primary">{formatAvg(Number(battingStats.avg))}</TableCell>
                        <TableCell>{formatAvg(Number(battingStats.obp))}</TableCell>
                        <TableCell>{formatAvg(Number(battingStats.slg))}</TableCell>
                        <TableCell>{formatAvg(Number(battingStats.ops))}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No batting stats yet</p>
          )}
        </TabsContent>

        <TabsContent value="fielding">
          {fieldingStats && Number(fieldingStats.total_chances) > 0 ? (
            <Card className="glass border-border/50">
              <CardHeader className="px-3 sm:px-6">
                <CardTitle className="text-gradient">Season Fielding Stats</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-3 gap-3 sm:hidden">
                  {[
                    { label: "G", value: fieldingStats.games },
                    { label: "PO", value: fieldingStats.putouts },
                    { label: "A", value: fieldingStats.assists },
                    { label: "E", value: fieldingStats.errors },
                    { label: "TC", value: fieldingStats.total_chances },
                    { label: "FLD%", value: Number(fieldingStats.fielding_pct).toFixed(3) },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="text-lg font-bold tabular-nums">{s.value}</div>
                      <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>G</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead>A</TableHead>
                        <TableHead>E</TableHead>
                        <TableHead>TC</TableHead>
                        <TableHead>FLD%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-border/30">
                        <TableCell>{fieldingStats.games}</TableCell>
                        <TableCell>{fieldingStats.putouts}</TableCell>
                        <TableCell>{fieldingStats.assists}</TableCell>
                        <TableCell>{fieldingStats.errors}</TableCell>
                        <TableCell>{fieldingStats.total_chances}</TableCell>
                        <TableCell className="font-bold text-primary">{Number(fieldingStats.fielding_pct).toFixed(3)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No fielding stats yet</p>
          )}
        </TabsContent>

        <TabsContent value="gamelog">
          {gameLog.length > 0 ? (
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="text-gradient">Game Log</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Opponent</TableHead>
                      <TableHead>AB</TableHead>
                      <TableHead>H</TableHead>
                      <TableHead>RBI</TableHead>
                      <TableHead>Results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameLog.map((g) => {
                      const ab = g.appearances.filter((pa) => pa.is_at_bat).length;
                      const h = g.appearances.filter((pa) => pa.is_hit).length;
                      const rbi = g.appearances.reduce((sum, pa) => sum + pa.rbis, 0);
                      return (
                        <TableRow key={g.game_id} className="border-border/30">
                          <TableCell>
                            <Link href={`/games/${g.game_id}`} className="text-primary hover:underline">
                              {new Date(g.date + "T00:00:00").toLocaleDateString()}
                            </Link>
                          </TableCell>
                          <TableCell>{g.opponent}</TableCell>
                          <TableCell className="tabular-nums">{ab}</TableCell>
                          <TableCell className="tabular-nums">{h}</TableCell>
                          <TableCell className="tabular-nums">{rbi}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {g.appearances.map((pa) => pa.result).join(", ")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No game log yet</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
