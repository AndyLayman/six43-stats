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
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Games</h1>
        <Link href="/games/new">
          <Button>New Game</Button>
        </Link>
      </div>

      {games.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No games yet. Create your first game!</p>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Link key={game.id} href={`/games/${game.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer mb-3">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground w-24">
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
                        <span className="text-lg font-bold">
                          {game.our_score} - {game.opponent_score}
                        </span>
                        <Badge variant={game.our_score > game.opponent_score ? "default" : "secondary"}>
                          {game.our_score > game.opponent_score ? "W" : game.our_score < game.opponent_score ? "L" : "T"}
                        </Badge>
                      </>
                    ) : game.status === "in_progress" ? (
                      <Badge className="bg-green-600">Live</Badge>
                    ) : (
                      <Badge variant="outline">Scheduled</Badge>
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
