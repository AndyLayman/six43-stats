"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cachedQuery } from "@/lib/query-cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MilestoneFeed } from "@/components/milestone-feed";
import { useRefresh } from "@/components/pull-to-refresh";
import { DashboardSkeleton } from "@/components/skeleton";
import { AnimatedNumber } from "@/components/animated-number";
import { formatTime12 } from "@/lib/stats/calculations";
import { fullName } from "@/lib/player-name";
import { Trophy, Gym } from "iconoir-react";
import type { Game, Player, BattingStats, ChainAward } from "@/lib/scoring/types";

export default function Dashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([]);
  const [allFinalGames, setAllFinalGames] = useState<Game[]>([]);
  const [battingStats, setBattingStats] = useState<BattingStats[]>([]);
  const [chainHolders, setChainHolders] = useState<{ gameChain: { player: Player; award: ChainAward } | null; hardWorker: { player: Player; award: ChainAward } | null }>({ gameChain: null, hardWorker: null });
  const [loading, setLoading] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];

    // 3 queries instead of 7: all games in one, both chain awards in one
    const [playersRes, gamesRes, statsRes, chainRes] = await Promise.all([
      cachedQuery<Player[]>("players", () => supabase.from("players").select("*").order("sort_order")),
      cachedQuery<Game[]>("games:all", () => supabase.from("games").select("*")),
      cachedQuery<BattingStats[]>("batting_stats", () => supabase.from("batting_stats_season").select("*").order("avg", { ascending: false }).limit(5)),
      cachedQuery<ChainAward[]>("chain:all", () => supabase.from("chain_awards").select("*").order("date", { ascending: false }).limit(10)),
    ]);

    // Surface any Supabase errors
    const results = { playersRes, gamesRes, statsRes, chainRes };
    const errors = Object.entries(results)
      .filter(([, res]) => res.error)
      .map(([key, res]) => `${key}: ${res.error!.message}`);
    if (errors.length > 0) {
      console.error("[Dashboard] query errors:", errors);
      setFetchError(errors.join("; "));
    } else {
      setFetchError(null);
    }

    const allPlayers: Player[] = playersRes.data ?? [];
    const allGames: Game[] = gamesRes.data ?? [];
    const allChainAwards: ChainAward[] = chainRes.data ?? [];

    // Derive recent, upcoming, and final games from the single query
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0];
    const recent = allGames
      .filter((g) => g.date >= fiveDaysAgo && g.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    const upcoming = allGames
      .filter((g) => g.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
    const finalGames = allGames.filter((g) => g.status === "final");

    // Derive chain holders from single query
    const gcAward = allChainAwards.find((a) => a.award_type === "game_chain") ?? null;
    const hwAward = allChainAwards.find((a) => a.award_type === "hard_worker") ?? null;

    setPlayers(allPlayers);
    setRecentGames(recent);
    setUpcomingGames(upcoming);
    setAllFinalGames(finalGames);
    setBattingStats(statsRes.data ?? []);
    setChainHolders({
      gameChain: gcAward ? { player: allPlayers.find(p => p.id === gcAward.player_id)!, award: gcAward } : null,
      hardWorker: hwAward ? { player: allPlayers.find(p => p.id === hwAward.player_id)!, award: hwAward } : null,
    });
    setShowUpcoming(recent.length === 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useRefresh(load);

  const formatAvgCounter = useCallback((v: number) => {
    return v.toFixed(3).replace(/^0/, "");
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {fetchError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Data error:</strong> {fetchError}
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">Dashboard</h1>
        <Link href="/games/new">
          <Button className="h-11 px-5 text-base active:scale-95 transition-transform glow-primary">
            New Game
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 stagger-children">
        {(() => {
          const wins = allFinalGames.filter((g) => g.our_score > g.opponent_score).length;
          const losses = allFinalGames.filter((g) => g.our_score < g.opponent_score).length;
          const teamAvg = battingStats.length > 0
            ? battingStats.reduce((sum, s) => sum + Number(s.avg), 0) / battingStats.length
            : null;

          const cards: { label: string; href: string; content: React.ReactNode }[] = [
            {
              label: "Players",
              href: "/players",
              content: <AnimatedNumber value={players.length} />,
            },
            {
              label: "Games Played",
              href: "/schedule",
              content: <AnimatedNumber value={allFinalGames.length} />,
            },
            {
              label: "Record",
              href: "/schedule",
              content: <><AnimatedNumber value={wins} />-<AnimatedNumber value={losses} /></>,
            },
            {
              label: "Team AVG",
              href: "/leaderboard",
              content: teamAvg !== null
                ? <AnimatedNumber value={teamAvg} format={formatAvgCounter} duration={800} />
                : "---",
            },
          ];

          return cards.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="card-hover glass gradient-border h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-extrabold tabular-nums text-gradient-bright">{stat.content}</div>
                </CardContent>
              </Card>
            </Link>
          ));
        })()}
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
        <CardContent className="space-y-4">
          {(chainHolders.gameChain || chainHolders.hardWorker) && (
            <div className="grid grid-cols-2 gap-3">
              {chainHolders.gameChain && chainHolders.gameChain.player && (
                <Link
                  href={`/players/${chainHolders.gameChain.player.id}`}
                  className="rounded-xl border border-border/50 p-3 hover:bg-accent hover:border-primary/20 transition-all group"
                >
                  <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Game Chain</div>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        #{chainHolders.gameChain.player.number} {fullName(chainHolders.gameChain.player)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Since {new Date(chainHolders.gameChain.award.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                </Link>
              )}
              {chainHolders.hardWorker && chainHolders.hardWorker.player && (
                <Link
                  href={`/players/${chainHolders.hardWorker.player.id}`}
                  className="rounded-xl border border-border/50 p-3 hover:bg-accent hover:border-primary/20 transition-all group"
                >
                  <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Hard Worker</div>
                  <div className="flex items-center gap-2">
                    <Gym className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        #{chainHolders.hardWorker.player.number} {fullName(chainHolders.hardWorker.player)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Since {new Date(chainHolders.hardWorker.award.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}
          <MilestoneFeed />
        </CardContent>
      </Card>
    </div>
  );
}
