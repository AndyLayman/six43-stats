"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VenuePicker } from "@/components/venue-picker";
import { TimePicker } from "@/components/time-picker";
import { CustomSelect } from "@/components/custom-select";
import { fullName } from "@/lib/player-name";
import type { Player } from "@/lib/scoring/types";
import { NavArrowUp, NavArrowDown, Menu } from "iconoir-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function SortableNewLineupRow({ player, orderIdx, totalSelected, position, onPositionChange, onToggle, onMove, isDragging }: {
  player: Player;
  orderIdx: number;
  totalSelected: number;
  position: string;
  onPositionChange: (val: string) => void;
  onToggle: () => void;
  onMove: (dir: "up" | "down") => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: player.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-xl border p-3 transition-all bg-primary/10 border-primary/30">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground shrink-0 p-0.5" tabIndex={-1}>
        <Menu width={14} height={14} />
      </button>
      <span className="text-sm font-bold text-primary w-5">{orderIdx + 1}</span>
      <span className="font-medium flex-1 text-base cursor-pointer" onClick={onToggle}>
        #{player.number} {fullName(player)}
      </span>
      <div className="flex items-center gap-1">
        <CustomSelect
          value={position}
          onChange={onPositionChange}
          options={[{ value: "", label: "Pos" }, ...FIELD_POSITIONS.map((pos) => ({ value: pos.value, label: pos.label }))]}
          placeholder="Pos"
          className="h-10 w-20"
        />
        <button
          type="button"
          className="h-10 w-10 flex items-center justify-center rounded-lg border border-border/50 text-lg active:bg-accent active:scale-95 transition-all disabled:opacity-30"
          onClick={() => onMove("up")}
          disabled={orderIdx === 0}
        >
          <NavArrowUp width={14} height={14} />
        </button>
        <button
          type="button"
          className="h-10 w-10 flex items-center justify-center rounded-lg border border-border/50 text-lg active:bg-accent active:scale-95 transition-all disabled:opacity-30"
          onClick={() => onMove("down")}
          disabled={orderIdx === totalSelected - 1}
        >
          <NavArrowDown width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export default function NewGamePage() {
  const router = useRouter();
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState<"home" | "away">("home");
  const [gameTime, setGameTime] = useState("");
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
        game_time: gameTime.trim() || null,
        venue: venue.trim() || null,
        venue_address: venueAddress.trim() || null,
        num_innings: 5,
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

  const [activeDragPlayerId, setActiveDragPlayerId] = useState<number | null>(null);
  const lineupSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleLineupDragStart(event: DragStartEvent) {
    setActiveDragPlayerId(event.active.id as number);
  }

  function handleLineupDragEnd(event: DragEndEvent) {
    setActiveDragPlayerId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSelectedPlayers((prev) => {
      const oldIndex = prev.indexOf(active.id as number);
      const newIndex = prev.indexOf(over.id as number);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
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

            {/* Game Time */}
            <div>
              <Label>Game Time</Label>
              <div className="mt-1">
                <TimePicker value={gameTime} onChange={setGameTime} />
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
              Select players and arrange the batting order. Drag or use arrows to reorder.
            </p>
            <DndContext sensors={lineupSensors} collisionDetection={closestCenter} onDragStart={handleLineupDragStart} onDragEnd={handleLineupDragEnd}>
              <SortableContext items={selectedPlayers} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {/* Selected players in batting order */}
                  {selectedPlayers.map((playerId, orderIdx) => {
                    const player = players.find((p) => p.id === playerId);
                    if (!player) return null;
                    return (
                      <SortableNewLineupRow
                        key={player.id}
                        player={player}
                        orderIdx={orderIdx}
                        totalSelected={selectedPlayers.length}
                        position={positions[player.id] || ""}
                        onPositionChange={(val) => setPositions((prev) => ({ ...prev, [player.id]: val }))}
                        onToggle={() => togglePlayer(player.id)}
                        onMove={(dir) => movePlayer(player.id, dir)}
                        isDragging={activeDragPlayerId === player.id}
                      />
                    );
                  })}
                  {/* Unselected players below */}
                  {players.filter((p) => !selectedPlayers.includes(p.id)).map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer border-border/50 hover:border-border"
                      onClick={() => togglePlayer(player.id)}
                    >
                      <input type="checkbox" checked={false} onChange={() => {}} className="h-5 w-5 pointer-events-none accent-primary" />
                      <span className="font-medium flex-1 text-base">
                        #{player.number} {fullName(player)}
                        {player.position && <span className="ml-1 text-xs text-muted-foreground">({player.position})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragPlayerId ? (() => {
                  const player = players.find((p) => p.id === activeDragPlayerId);
                  if (!player) return null;
                  const orderIdx = selectedPlayers.indexOf(player.id);
                  return (
                    <div className="flex items-center gap-3 rounded-xl border-2 border-primary/60 bg-sidebar p-3 shadow-xl cursor-grabbing">
                      <span className="text-sm font-bold text-primary w-5">{orderIdx + 1}</span>
                      <span className="font-medium flex-1 text-base">#{player.number} {fullName(player)}</span>
                      {positions[player.id] && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{positions[player.id]}</span>
                      )}
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
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
