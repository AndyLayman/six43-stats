"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Game } from "@/lib/scoring/types";

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("games").select("*").order("date", { ascending: false });
      setGames(data ?? []);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-gradient">Games</h1>
        <Link href="/games/new">
          <Button className="glow-primary">New Game</Button>
        </Link>
      </div>

      {games.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No games yet. Create your first game!</p>
      ) : (
        <div className="space-y-3 stagger-children">
          {games.map((game) => (
            <Link key={game.id} href={`/games/${game.id}`}>
              <Card className="card-hover glass cursor-pointer mb-3">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground w-24 tabular-nums">
                      {new Date(game.date + "T00:00:00").toLocaleDateString()}
                    </div>
                    <div>
                      <div className="font-semibold">
                        {game.location === "home" ? "vs" : "@"} {game.opponent}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {game.status === "final" ? (
                      <>
                        <span className="text-lg font-bold tabular-nums">
                          {game.our_score} - {game.opponent_score}
                        </span>
                        <Badge
                          variant={game.our_score > game.opponent_score ? "default" : "secondary"}
                          className={game.our_score > game.opponent_score ? "bg-primary/20 text-primary border-primary/30" : ""}
                        >
                          {game.our_score > game.opponent_score ? "W" : game.our_score < game.opponent_score ? "L" : "T"}
                        </Badge>
                      </>
                    ) : game.status === "in_progress" ? (
                      <Badge className="bg-primary/20 text-primary border border-primary/30 animate-pulse">Live</Badge>
                    ) : (
                      <Badge variant="outline" className="border-border/50 text-muted-foreground">Scheduled</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
