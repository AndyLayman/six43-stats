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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">Dashboard</h1>
        <Link href="/games/new">
          <Button className="h-11 px-5 text-base active:scale-95 transition-transform glow-primary">
            New Game
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 stagger-children">
        {[
          { label: "Players", value: players.length, href: "/players" },
          { label: "Games Played", value: games.filter((g) => g.status === "final").length, href: "/games" },
          {
            label: "Record",
            value: `${games.filter((g) => g.status === "final" && g.our_score > g.opponent_score).length}-${games.filter((g) => g.status === "final" && g.our_score < g.opponent_score).length}`,
            href: "/games",
          },
          {
            label: "Team AVG",
            value:
              battingStats.length > 0
                ? (battingStats.reduce((sum, s) => sum + Number(s.avg), 0) / battingStats.length)
                    .toFixed(3)
                    .replace(/^0/, "")
                : "---",
            href: "/leaderboard",
          },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="card-hover glass gradient-border h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold tabular-nums text-gradient-bright">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass border-border/50">
          <CardHeader>
            <Link href="/games" className="text-lg font-bold text-gradient hover:opacity-80 transition-opacity">Recent Games</Link>
          </CardHeader>
          <CardContent>
            {games.length === 0 ? (
              <p className="text-muted-foreground text-sm">No games yet. Start by creating a new game!</p>
            ) : (
              <div className="space-y-2 stagger-children">
                {games.map((game) => (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="flex items-center justify-between rounded-xl border border-border/50 p-3 hover:bg-accent hover:border-primary/20 transition-all duration-200 group"
                  >
                    <div>
                      <div className="font-semibold group-hover:text-primary transition-colors">
                        {game.location === "home" ? "vs" : "@"} {game.opponent}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(game.date + "T00:00:00").toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      {game.status === "final" ? (
                        <div className="font-bold tabular-nums">
                          {game.our_score} - {game.opponent_score}
                        </div>
                      ) : game.status === "in_progress" ? (
                        <span className="text-sm font-semibold text-primary animate-pulse">Live</span>
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

        <Card className="glass border-border/50">
          <CardHeader>
            <Link href="/leaderboard" className="text-lg font-bold text-gradient hover:opacity-80 transition-opacity">Batting Leaders</Link>
          </CardHeader>
          <CardContent>
            {battingStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No stats yet. Score a game to see leaders!</p>
            ) : (
              <div className="space-y-3 stagger-children">
                {battingStats.map((stat, i) => (
                  <Link
                    key={stat.player_id}
                    href={`/players/${stat.player_id}`}
                    className="flex items-center justify-between rounded-xl p-2 -mx-2 hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-5 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <span className="font-semibold group-hover:text-primary transition-colors">{stat.player_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm tabular-nums">
                      <span className="text-gradient-bright font-semibold">
                        {Number(stat.avg).toFixed(3).replace(/^0/, "")} AVG
                      </span>
                      <span className="text-muted-foreground">{stat.hits} H</span>
                      <span className="text-muted-foreground">{stat.rbis} RBI</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
