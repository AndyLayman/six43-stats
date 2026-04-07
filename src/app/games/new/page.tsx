"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VenuePicker } from "@/components/venue-picker";
import { CustomSelect } from "@/components/custom-select";
import { fullName } from "@/lib/player-name";
import type { Player } from "@/lib/scoring/types";

const FIELD_POSITIONS = [
  { value: "P", label: "P" },
  { value: "C", label: "C" },
  { value: "1B", label: "1B" },
  { value: "2B", label: "2B" },
  { value: "3B", label: "3B" },
  { value: "SS", label: "SS" },
  { value: "LF", label: "LF" },
  { value: "LC", label: "LC" },
  { value: "RC", label: "RC" },
  { value: "RF", label: "RF" },
  { value: "DH", label: "DH" },
  { value: "BN1", label: "BN1" },
  { value: "BN2", label: "BN2" },
  { value: "BN3", label: "BN3" },
  { value: "BN4", label: "BN4" },
];

export default function NewGamePage() {
  const router = useRouter();
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState<"home" | "away">("home");
  const [venue, setVenue] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [positions, setPositions] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("players").select("*").order("sort_order");
      const allPlayers: Player[] = data ?? [];
      setPlayers(allPlayers);
      setSelectedPlayers(allPlayers.map((p) => p.id));
      // Pre-fill positions from each player's default position
      const defaultPositions: Record<number, string> = {};
      for (const p of allPlayers) {
        if (p.position) defaultPositions[p.id] = p.position;
      }
      setPositions(defaultPositions);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!opponent.trim() || selectedPlayers.length === 0) return;

    setSaving(true);

    const { data: game, error } = await supabase
      .from("games")
      .insert({
        opponent: opponent.trim(),
        date,
        location,
        venue: venue.trim() || null,
        venue_address: venueAddress.trim() || null,
        status: "scheduled",
      })
      .select()
      .single();

    if (error || !game) {
      alert("Failed to create game: " + (error?.message ?? "Unknown error"));
      setSaving(false);
      return;
    }

    const lineupRows = selectedPlayers.map((playerId, idx) => ({
      game_id: game.id,
      player_id: playerId,
      batting_order: idx + 1,
      position: positions[playerId] || "",
    }));

    await supabase.from("game_lineup").insert(lineupRows);

    await supabase.from("game_state").insert({
      game_id: game.id,
      current_inning: 1,
      current_half: "top",
      outs: 0,
      current_batter_index: 0,
    });

    router.push(`/games/${game.id}`);
  }

  function togglePlayer(playerId: number) {
    setSelectedPlayers((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  }

  function movePlayer(playerId: number, direction: "up" | "down") {
    setSelectedPlayers((prev) => {
      const idx = prev.indexOf(playerId);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-gradient">New Game</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Game Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="opponent">Opponent</Label>
              <Input
                id="opponent"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Team name"
                required
                className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 [&>*]:min-w-0">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 text-base w-full bg-input/50 border-border/50 focus:border-primary/50"
                />
              </div>
              <div>
                <Label>Location</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={location === "home" ? "default" : "outline"}
                    onClick={() => setLocation("home")}
                    className={`flex-1 h-12 text-base active:scale-95 transition-all ${
                      location === "home" ? "glow-primary" : "border-border/50"
                    }`}
                  >
                    Home
                  </Button>
                  <Button
                    type="button"
                    variant={location === "away" ? "default" : "outline"}
                    onClick={() => setLocation("away")}
                    className={`flex-1 h-12 text-base active:scale-95 transition-all ${
                      location === "away" ? "glow-primary" : "border-border/50"
                    }`}
                  >
                    Away
                  </Button>
                </div>
              </div>
            </div>

            {/* Venue */}
            <div>
              <Label>Venue / Field</Label>
              <div className="mt-1">
                <VenuePicker
                  venue={venue}
                  venueAddress={venueAddress}
                  onVenueChange={setVenue}
                  onAddressChange={setVenueAddress}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Batting Order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Select players and arrange the batting order. Use arrows to reorder.
            </p>
            <div className="space-y-2">
              {players.map((player) => {
                const isSelected = selectedPlayers.includes(player.id);
                const orderIdx = selectedPlayers.indexOf(player.id);
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "border-border/50 hover:border-border"
                    }`}
                    onClick={() => togglePlayer(player.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-5 w-5 pointer-events-none accent-primary"
                    />
                    {isSelected && (
                      <span className="text-sm font-bold text-primary w-5">{orderIdx + 1}</span>
                    )}
                    <span className="font-medium flex-1 text-base">
                      #{player.number} {fullName(player)}
                      {!isSelected && player.position && (
                        <span className="ml-1 text-xs text-muted-foreground">({player.position})</span>
                      )}
                    </span>
                    {isSelected && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          value={positions[player.id] || ""}
                          onChange={(val) => setPositions((prev) => ({ ...prev, [player.id]: val }))}
                          options={[{ value: "", label: "Pos" }, ...FIELD_POSITIONS.map((pos) => ({ value: pos.value, label: pos.label }))]}
                          placeholder="Pos"
                          className="h-10 w-20"
                        />
                        <button
                          type="button"
                          className="h-10 w-10 flex items-center justify-center rounded-lg border border-border/50 text-lg active:bg-accent active:scale-95 transition-all disabled:opacity-30"
                          onClick={() => movePlayer(player.id, "up")}
                          disabled={orderIdx === 0}
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          className="h-10 w-10 flex items-center justify-center rounded-lg border border-border/50 text-lg active:bg-accent active:scale-95 transition-all disabled:opacity-30"
                          onClick={() => movePlayer(player.id, "down")}
                          disabled={orderIdx === selectedPlayers.length - 1}
                        >
                          &darr;
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full h-14 text-lg font-bold glow-primary active:scale-[0.98] transition-transform"
          size="lg"
          disabled={saving || !opponent.trim() || selectedPlayers.length === 0}
        >
          {saving ? "Creating..." : "Create Game"}
        </Button>
      </form>
    </div>
  );
}
