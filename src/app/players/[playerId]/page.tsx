"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAvg } from "@/lib/stats/calculations";
import type { Player, PlateAppearance, BattingStats, FieldingStats } from "@/lib/scoring/types";

export default function PlayerDetailPage() {
  const params = useParams();
  const playerId = Number(params.playerId);
  const [player, setPlayer] = useState<Player | null>(null);
  const [battingStats, setBattingStats] = useState<BattingStats | null>(null);
  const [fieldingStats, setFieldingStats] = useState<FieldingStats | null>(null);
  const [gameLog, setGameLog] = useState<{ game_id: string; date: string; opponent: string; appearances: PlateAppearance[] }[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Build game log
      const games = gamesRes.data ?? [];
      const pas = pasRes.data ?? [];
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
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  if (!player) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Player not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-2xl">
          {player.number}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{player.name}</h1>
          <p className="text-muted-foreground">#{player.number}</p>
        </div>
      </div>

      {/* Season stat highlights */}
      {battingStats && Number(battingStats.at_bats) > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
          {[
            { label: "AVG", value: formatAvg(Number(battingStats.avg)) },
            { label: "OBP", value: formatAvg(Number(battingStats.obp)) },
            { label: "SLG", value: formatAvg(Number(battingStats.slg)) },
            { label: "OPS", value: formatAvg(Number(battingStats.ops)) },
            { label: "HR", value: String(battingStats.home_runs) },
            { label: "RBI", value: String(battingStats.rbis) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="batting">
        <TabsList>
          <TabsTrigger value="batting">Batting</TabsTrigger>
          <TabsTrigger value="fielding">Fielding</TabsTrigger>
          <TabsTrigger value="gamelog">Game Log</TabsTrigger>
        </TabsList>

        <TabsContent value="batting">
          {battingStats && Number(battingStats.at_bats) > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Season Batting Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
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
                    <TableRow>
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
                      <TableCell className="font-bold">{formatAvg(Number(battingStats.avg))}</TableCell>
                      <TableCell>{formatAvg(Number(battingStats.obp))}</TableCell>
                      <TableCell>{formatAvg(Number(battingStats.slg))}</TableCell>
                      <TableCell>{formatAvg(Number(battingStats.ops))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No batting stats yet</p>
          )}
        </TabsContent>

        <TabsContent value="fielding">
          {fieldingStats && Number(fieldingStats.total_chances) > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Season Fielding Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>G</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead>A</TableHead>
                      <TableHead>E</TableHead>
                      <TableHead>TC</TableHead>
                      <TableHead>FLD%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{fieldingStats.games}</TableCell>
                      <TableCell>{fieldingStats.putouts}</TableCell>
                      <TableCell>{fieldingStats.assists}</TableCell>
                      <TableCell>{fieldingStats.errors}</TableCell>
                      <TableCell>{fieldingStats.total_chances}</TableCell>
                      <TableCell className="font-bold">{Number(fieldingStats.fielding_pct).toFixed(3)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No fielding stats yet</p>
          )}
        </TabsContent>

        <TabsContent value="gamelog">
          {gameLog.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Game Log</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        <TableRow key={g.game_id}>
                          <TableCell>
                            <Link href={`/games/${g.game_id}`} className="text-primary hover:underline">
                              {new Date(g.date + "T00:00:00").toLocaleDateString()}
                            </Link>
                          </TableCell>
                          <TableCell>{g.opponent}</TableCell>
                          <TableCell>{ab}</TableCell>
                          <TableCell>{h}</TableCell>
                          <TableCell>{rbi}</TableCell>
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
