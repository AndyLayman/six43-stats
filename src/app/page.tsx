"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MilestoneFeed } from "@/components/milestone-feed";
import { formatTime12 } from "@/lib/stats/calculations";
import type { Game, Player, BattingStats } from "@/lib/scoring/types";

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);
  const [allFinalGames, setAllFinalGames] = useState<Game[]>([]);
  const [battingStats, setBattingStats] = useState<BattingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0];

      const [playersRes, recentRes, upcomingRes, allGamesRes, statsRes] = await Promise.all([
        supabase.from("players").select("*").order("sort_order"),
        supabase.from("games").select("*").gte("date", fiveDaysAgo).lte("date", today).order("date", { ascending: false }).limit(5),
        supabase.from("games").select("*").gt("date", today).order("date", { ascending: true }).limit(5),
        supabase.from("games").select("*").eq("status", "final"),
        supabase.from("batting_stats_season").select("*").order("avg", { ascending: false }).limit(5),
      ]);

      const recent = recentRes.data ?? [];
      const upcoming = upcomingRes.data ?? [];

      setPlayers(playersRes.data ?? []);
      setRecentGames(recent);
      setUpcomingGames(upcoming);
      setAllFinalGames(allGamesRes.data ?? []);
      setBattingStats(statsRes.data ?? []);
      setShowUpcoming(recent.length === 0);
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
          { label: "Games Played", value: allFinalGames.length, href: "/schedule" },
          {
            label: "Record",
            value: `${allFinalGames.filter((g) => g.our_score > g.opponent_score).length}-${allFinalGames.filter((g) => g.our_score < g.opponent_score).length}`,
            href: "/schedule",
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
            <Link href="/schedule" className="text-lg font-bold text-gradient hover:opacity-80 transition-opacity">
              {showUpcoming ? "Upcoming Games" : "Recent Games"}
            </Link>
          </CardHeader>
          <CardContent>
            {(() => {
              const displayGames = showUpcoming ? upcomingGames : recentGames;
              if (displayGames.length === 0) {
                return (
                  <p className="text-muted-foreground text-sm">
                    {showUpcoming ? "No upcoming games scheduled." : "No games yet. Start by creating a new game!"}
                  </p>
                );
              }
              return (
                <div className="space-y-2 stagger-children">
                  {displayGames.map((game) => (
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
                          {game.game_time ? ` · ${formatTime12(game.game_time)}` : ""}
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
              );
            })()}
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

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg text-gradient">Awards & Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <MilestoneFeed />
        </CardContent>
      </Card>
    </div>
  );
}
