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
import type { Game, GameLineup, Player, PlateAppearance } from "@/lib/scoring/types";

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [lineup, setLineup] = useState<(GameLineup & { player: Player })[]>([]);
  const [appearances, setAppearances] = useState<PlateAppearance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [gameRes, lineupRes, pasRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("game_lineup").select("*, player:players(*)").eq("game_id", gameId).order("batting_order"),
        supabase.from("plate_appearances").select("*").eq("game_id", gameId).order("created_at"),
      ]);

      setGame(gameRes.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLineup((lineupRes.data as any) ?? []);
      setAppearances(pasRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [gameId]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  if (!game) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Game not found</div>;
  }

  // Get max innings from appearances
  const maxInning = appearances.length > 0 ? Math.max(...appearances.map((pa) => pa.inning)) : 0;
  const innings = Array.from({ length: Math.max(maxInning, 1) }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {game.location === "home" ? "vs" : "@"} {game.opponent}
          </h1>
          <p className="text-muted-foreground">
            {new Date(game.date + "T00:00:00").toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {game.status !== "final" && (
            <Link href={`/games/${gameId}/live`}>
              <Button>{game.status === "in_progress" ? "Continue Scoring" : "Start Scoring"}</Button>
            </Link>
          )}
          <Badge variant={game.status === "final" ? "default" : game.status === "in_progress" ? "default" : "outline"}>
            {game.status === "in_progress" ? "Live" : game.status === "final" ? "Final" : "Scheduled"}
          </Badge>
        </div>
      </div>

      {/* Scoreboard */}
      {(game.status === "final" || game.status === "in_progress") && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-5xl font-bold">
                {game.our_score} - {game.opponent_score}
              </div>
              <div className="text-muted-foreground mt-1">
                {game.innings_played > 0 ? `${game.innings_played} innings` : ""}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Score */}
      {lineup.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Box Score</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Player</TableHead>
                  {innings.map((inn) => (
                    <TableHead key={inn} className="text-center w-16">
                      {inn}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">AB</TableHead>
                  <TableHead className="text-center">H</TableHead>
                  <TableHead className="text-center">RBI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineup.map((entry) => {
                  const playerPAs = appearances.filter((pa) => pa.player_id === entry.player_id);
                  const ab = playerPAs.filter((pa) => pa.is_at_bat).length;
                  const h = playerPAs.filter((pa) => pa.is_hit).length;
                  const rbi = playerPAs.reduce((sum, pa) => sum + pa.rbis, 0);

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-bold text-muted-foreground">{entry.batting_order}</TableCell>
                      <TableCell>
                        <Link href={`/players/${entry.player_id}`} className="hover:underline">
                          {entry.player?.name ?? `Player ${entry.player_id}`}
                        </Link>
                      </TableCell>
                      {innings.map((inn) => {
                        const innPAs = playerPAs.filter((pa) => pa.inning === inn);
                        return (
                          <TableCell key={inn} className="text-center text-sm">
                            {innPAs.map((pa) => pa.scorebook_notation || pa.result).join(", ") || ""}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">{ab}</TableCell>
                      <TableCell className="text-center font-bold">{h}</TableCell>
                      <TableCell className="text-center">{rbi}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
