"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import type { Player } from "@/lib/scoring/types";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("players").select("*").order("sort_order");
      setPlayers(data ?? []);
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
      <h1 className="text-3xl font-extrabold tracking-tight text-gradient">Players</h1>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 stagger-children">
        {players.map((player) => (
          <Link key={player.id} href={`/players/${player.id}`}>
            <Card className="card-hover glass gradient-border cursor-pointer">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 font-bold text-lg border border-primary/30 text-gradient-bright">
                  {player.number}
                </div>
                <div>
                  <div className="font-semibold">{player.name}</div>
                  <div className="text-sm text-muted-foreground">#{player.number}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
