"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Game, Player, BattingStats } from "@/lib/scoring/types";

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [battingStats, setBattingStats] = useState<BattingStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [playersRes, gamesRes, statsRes] = await Promise.all([
        supabase.from("players").select("*").order("sort_order"),
        supabase.from("games").select("*").order("date", { ascending: false }).limit(5),
        supabase.from("batting_stats_season").select("*").order("avg", { ascending: false }).limit(5),
      ]);
      setPlayers(playersRes.data ?? []);
      setGames(gamesRes.data ?? []);
      setBattingStats(statsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Link href="/games/new">
          <Button>New Game</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{players.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Games Played</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{games.filter((g) => g.status === "final").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Record</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {games.filter((g) => g.status === "final" && g.our_score > g.opponent_score).length}-
              {games.filter((g) => g.status === "final" && g.our_score < g.opponent_score).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team AVG</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {battingStats.length > 0
                ? (battingStats.reduce((sum, s) => sum + Number(s.avg), 0) / battingStats.length)
                    .toFixed(3)
                    .replace(/^0/, "")
                : "---"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Games</CardTitle>
          </CardHeader>
          <CardContent>
            {games.length === 0 ? (
              <p className="text-muted-foreground text-sm">No games yet. Start by creating a new game!</p>
            ) : (
              <div className="space-y-3">
                {games.map((game) => (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="font-medium">
                        {game.location === "home" ? "vs" : "@"} {game.opponent}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(game.date + "T00:00:00").toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      {game.status === "final" ? (
                        <div className="font-bold">
                          {game.our_score} - {game.opponent_score}
                        </div>
                      ) : game.status === "in_progress" ? (
                        <span className="text-sm font-medium text-green-600">Live</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Scheduled</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batting Leaders</CardTitle>
          </CardHeader>
          <CardContent>
            {battingStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No stats yet. Score a game to see leaders!</p>
            ) : (
              <div className="space-y-3">
                {battingStats.map((stat, i) => (
                  <div key={stat.player_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                      <span className="font-medium">{stat.player_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{Number(stat.avg).toFixed(3).replace(/^0/, "")} AVG</span>
                      <span>{stat.hits} H</span>
                      <span>{stat.rbis} RBI</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
