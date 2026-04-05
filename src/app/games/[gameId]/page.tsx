"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAvg } from "@/lib/stats/calculations";
import type { Game, GameLineup, Player, PlateAppearance, OpponentBatter } from "@/lib/scoring/types";

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [lineup, setLineup] = useState<(GameLineup & { player: Player })[]>([]);
  const [opponentLineup, setOpponentLineup] = useState<OpponentBatter[]>([]);
  const [appearances, setAppearances] = useState<PlateAppearance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [gameRes, lineupRes, pasRes, oppRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("game_lineup").select("*, player:players(*)").eq("game_id", gameId).order("batting_order"),
        supabase.from("plate_appearances").select("*").eq("game_id", gameId).order("created_at"),
        supabase.from("opponent_lineup").select("*").eq("game_id", gameId).order("batting_order"),
      ]);

      setGame(gameRes.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLineup((lineupRes.data as any) ?? []);
      setOpponentLineup(oppRes.data ?? []);
      setAppearances(pasRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [gameId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!game) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Game not found</div>;
  }

  const ourAppearances = appearances.filter((pa) => (pa.team ?? "us") === "us");
  const oppAppearances = appearances.filter((pa) => pa.team === "them");
  const maxInning = appearances.length > 0 ? Math.max(...appearances.map((pa) => pa.inning)) : 0;
  const innings = Array.from({ length: Math.max(maxInning, 1) }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">
            {game.location === "home" ? "vs" : "@"} {game.opponent}
          </h1>
          <p className="text-muted-foreground">
            {new Date(game.date + "T00:00:00").toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {game.status !== "final" && (
            <Link href={`/games/${gameId}/live`}>
              <Button className="glow-primary">
                {game.status === "in_progress" ? "Continue Scoring" : "Start Scoring"}
              </Button>
            </Link>
          )}
          <Badge
            variant={game.status === "final" ? "default" : "outline"}
            className={
              game.status === "in_progress"
                ? "bg-primary/20 text-primary border-primary/30 animate-pulse"
                : game.status === "final"
                ? "bg-primary/20 text-primary border-primary/30"
                : "border-border/50 text-muted-foreground"
            }
          >
            {game.status === "in_progress" ? "Live" : game.status === "final" ? "Final" : "Scheduled"}
          </Badge>
        </div>
      </div>

      {/* Scoreboard */}
      {(game.status === "final" || game.status === "in_progress") && (
        <Card className="glass gradient-border glow-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{game.our_score}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Padres</div>
              </div>
              <div className="text-center">
                <div className="text-gradient text-3xl font-extrabold">-</div>
                {game.innings_played > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">{game.innings_played} inn</div>
                )}
              </div>
              <div className="text-center flex-1">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{game.opponent_score}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium truncate max-w-[120px] mx-auto">{game.opponent}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game Notes */}
      {game.notes && (
        <Card className="glass">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Notes</div>
            <div className="text-sm whitespace-pre-wrap">{game.notes}</div>
          </CardContent>
        </Card>
      )}

      {/* Box Score — Our Team */}
      {lineup.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-gradient">Our Box Score</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table className="min-w-0">
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">Player</TableHead>
                    {innings.map((inn) => (
                      <TableHead key={inn} className="text-center w-12 px-1">
                        {inn}
                      </TableHead>
                    ))}
                    <TableHead className="text-center px-2">AB</TableHead>
                    <TableHead className="text-center px-2">H</TableHead>
                    <TableHead className="text-center px-2">RBI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {lineup.map((entry) => {
                  const playerPAs = ourAppearances.filter((pa) => pa.player_id === entry.player_id);
                  const ab = playerPAs.filter((pa) => pa.is_at_bat).length;
                  const h = playerPAs.filter((pa) => pa.is_hit).length;
                  const rbi = playerPAs.reduce((sum, pa) => sum + pa.rbis, 0);

                  return (
                    <TableRow key={entry.id} className="border-border/30">
                      <TableCell className="sticky left-0 bg-card z-10">
                        <Link href={`/players/${entry.player_id}`} className="hover:text-primary font-medium transition-colors">
                          <span className="text-muted-foreground mr-1">{entry.batting_order}.</span>
                          {entry.player?.name ?? `Player ${entry.player_id}`}
                        </Link>
                      </TableCell>
                      {innings.map((inn) => {
                        const innPAs = playerPAs.filter((pa) => pa.inning === inn);
                        return (
                          <TableCell key={inn} className="text-center text-xs sm:text-sm px-1 whitespace-nowrap">
                            {innPAs.map((pa) => pa.scorebook_notation || pa.result).join(", ") || ""}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center tabular-nums">{ab}</TableCell>
                      <TableCell className="text-center font-bold text-primary tabular-nums">{h}</TableCell>
                      <TableCell className="text-center tabular-nums">{rbi}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Score — Opponent */}
      {opponentLineup.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-gradient">Opponent Box Score</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table className="min-w-0">
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">Batter</TableHead>
                    {innings.map((inn) => (
                      <TableHead key={inn} className="text-center w-12 px-1">
                        {inn}
                      </TableHead>
                    ))}
                    <TableHead className="text-center px-2">AB</TableHead>
                    <TableHead className="text-center px-2">H</TableHead>
                    <TableHead className="text-center px-2">RBI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {opponentLineup.map((entry) => {
                  const batterPAs = oppAppearances.filter((pa) => pa.opponent_batter_id === entry.id);
                  const ab = batterPAs.filter((pa) => pa.is_at_bat).length;
                  const h = batterPAs.filter((pa) => pa.is_hit).length;
                  const rbi = batterPAs.reduce((sum, pa) => sum + pa.rbis, 0);

                  return (
                    <TableRow key={entry.id} className="border-border/30">
                      <TableCell className="sticky left-0 bg-card z-10">
                        <span className="text-muted-foreground mr-1">{entry.batting_order}.</span>
                        <span className="font-medium">{entry.name}</span>
                      </TableCell>
                      {innings.map((inn) => {
                        const innPAs = batterPAs.filter((pa) => pa.inning === inn);
                        return (
                          <TableCell key={inn} className="text-center text-xs sm:text-sm px-1 whitespace-nowrap">
                            {innPAs.map((pa) => pa.scorebook_notation || pa.result).join(", ") || ""}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center tabular-nums">{ab}</TableCell>
                      <TableCell className="text-center font-bold text-primary tabular-nums">{h}</TableCell>
                      <TableCell className="text-center tabular-nums">{rbi}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
