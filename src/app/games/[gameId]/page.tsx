"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAvg, formatTime12 } from "@/lib/stats/calculations";
import { CustomSelect } from "@/components/custom-select";
import { VenuePicker } from "@/components/venue-picker";
import { TimePicker } from "@/components/time-picker";
import type { Game, GameLineup, Player, PlateAppearance, OpponentBatter } from "@/lib/scoring/types";
import { fullName } from "@/lib/player-name";
import { StatTip } from "@/components/stat-tip";
import { MapPin, NavArrowUp, NavArrowDown, EditPencil, Check, Xmark, Menu } from "iconoir-react";
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

function SortableLineupRow({ player, orderIdx, totalSelected, position, onPositionChange, onToggle, onMove, isDragging }: {
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
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-xl border p-2.5 transition-all bg-primary/10 border-primary/30">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground shrink-0 p-0.5" tabIndex={-1}>
        <Menu width={14} height={14} />
      </button>
      <span className="text-xs font-bold text-primary w-4 text-right">{orderIdx + 1}</span>
      <span className="font-medium flex-1 text-sm truncate cursor-pointer" onClick={onToggle}>
        #{player.number} {fullName(player)}
      </span>
      <div className="flex items-center gap-1">
        <CustomSelect
          value={position}
          onChange={onPositionChange}
          options={[{ value: "", label: "Pos" }, ...FIELD_POSITIONS.map((pos) => ({ value: pos.value, label: pos.label }))]}
          placeholder="Pos"
          className="h-9 w-[72px]"
        />
        <button
          type="button"
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/50 active:bg-accent active:scale-95 transition-all disabled:opacity-30"
          onClick={() => onMove("up")}
          disabled={orderIdx === 0}
        >
          <NavArrowUp width={14} height={14} />
        </button>
        <button
          type="button"
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/50 active:bg-accent active:scale-95 transition-all disabled:opacity-30"
          onClick={() => onMove("down")}
          disabled={orderIdx === totalSelected - 1}
        >
          <NavArrowDown width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [lineup, setLineup] = useState<(GameLineup & { player: Player })[]>([]);
  const [opponentLineup, setOpponentLineup] = useState<OpponentBatter[]>([]);
  const [appearances, setAppearances] = useState<PlateAppearance[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingInfo, setEditingInfo] = useState(false);
  const [editOpponent, setEditOpponent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editLocation, setEditLocation] = useState<"home" | "away">("home");
  const [editGameTime, setEditGameTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  // Venue editing
  const [editingVenue, setEditingVenue] = useState(false);
  const [editVenue, setEditVenue] = useState("");
  const [editVenueAddress, setEditVenueAddress] = useState("");

  // Lineup editing
  const [editingLineup, setEditingLineup] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [positions, setPositions] = useState<Record<number, string>>({});
  const [savingLineup, setSavingLineup] = useState(false);

  useEffect(() => {
    async function load() {
      const [gameRes, lineupRes, pasRes, oppRes, playersRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("game_lineup").select("*, player:players(*)").eq("game_id", gameId).order("batting_order"),
        supabase.from("plate_appearances").select("*").eq("game_id", gameId).order("created_at"),
        supabase.from("opponent_lineup").select("*").eq("game_id", gameId).order("batting_order"),
        supabase.from("players").select("*").order("sort_order"),
      ]);

      setGame(gameRes.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLineup((lineupRes.data as any) ?? []);
      setOpponentLineup(oppRes.data ?? []);
      setAppearances(pasRes.data ?? []);
      setAllPlayers(playersRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [gameId]);

  // --- Scheduled game helpers ---
  const isScheduled = game?.status === "scheduled";

  function startEditInfo() {
    if (!game) return;
    setEditOpponent(game.opponent);
    setEditDate(game.date);
    setEditLocation(game.location || "home");
    setEditGameTime(game.game_time || "");
    setEditNotes(game.notes || "");
    setEditingInfo(true);
  }

  async function saveInfo() {
    if (!game) return;
    setSavingInfo(true);
    const { error } = await supabase.from("games").update({
      opponent: editOpponent.trim(),
      date: editDate,
      location: editLocation,
      game_time: editGameTime.trim() || null,
      notes: editNotes.trim() || null,
    }).eq("id", gameId);
    if (!error) {
      setGame({ ...game, opponent: editOpponent.trim(), date: editDate, location: editLocation, game_time: editGameTime.trim() || null, notes: editNotes.trim() || null });
      setEditingInfo(false);
    }
    setSavingInfo(false);
  }

  function startEditVenue() {
    if (!game) return;
    setEditVenue(game.venue || "");
    setEditVenueAddress(game.venue_address || "");
    setEditingVenue(true);
  }

  async function saveVenue() {
    if (!game) return;
    await supabase.from("games").update({
      venue: editVenue.trim() || null,
      venue_address: editVenueAddress.trim() || null,
    }).eq("id", gameId);
    setGame({ ...game, venue: editVenue.trim() || null, venue_address: editVenueAddress.trim() || null });
    setEditingVenue(false);
  }

  function startEditLineup() {
    const currentIds = lineup.map((e) => e.player_id);
    const currentPositions: Record<number, string> = {};
    for (const e of lineup) currentPositions[e.player_id] = e.position;
    // If no lineup yet, default to all players in sort_order with default positions
    if (currentIds.length === 0) {
      setSelectedPlayers(allPlayers.map((p) => p.id));
      const defaults: Record<number, string> = {};
      for (const p of allPlayers) if (p.position) defaults[p.id] = p.position;
      setPositions(defaults);
    } else {
      setSelectedPlayers(currentIds);
      setPositions(currentPositions);
    }
    setEditingLineup(true);
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

  // Drag-and-drop for lineup reordering
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

  async function saveLineup() {
    setSavingLineup(true);
    // Delete existing lineup and re-insert
    await supabase.from("game_lineup").delete().eq("game_id", gameId);
    const rows = selectedPlayers.map((playerId, idx) => ({
      game_id: gameId,
      player_id: playerId,
      batting_order: idx + 1,
      position: positions[playerId] || "",
    }));
    await supabase.from("game_lineup").insert(rows);
    // Re-fetch lineup
    const { data } = await supabase.from("game_lineup").select("*, player:players(*)").eq("game_id", gameId).order("batting_order");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLineup((data as any) ?? []);
    setEditingLineup(false);
    setSavingLineup(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!game) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Game not found</div>;
  }

  const ourAppearances = appearances.filter((pa) => (pa.team ?? "us") === "us");
  const oppAppearances = appearances.filter((pa) => pa.team === "them");
  const maxInning = appearances.length > 0 ? Math.max(...appearances.map((pa) => pa.inning)) : 0;
  const innings = Array.from({ length: maxInning }, (_, i) => i + 1);

  // For countdown display
  const gameDate = new Date(game.date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((gameDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Determine projected lineup for display (lineup entries, or all players by default)
  const displayLineup = lineup.length > 0
    ? lineup
    : allPlayers.map((p, idx) => ({
        id: `default-${p.id}`,
        game_id: gameId,
        player_id: p.id,
        batting_order: idx + 1,
        position: p.position || "",
        player: p,
      }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">
            {game.location === "home" ? "vs" : "@"} {game.opponent}
          </h1>
          <p className="text-muted-foreground">
            {gameDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            {game.game_time ? ` · ${formatTime12(game.game_time)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {game.status !== "final" && (
            <Link href={`/games/${gameId}/live`}>
              <Button className="glow-primary">
                {game.status === "in_progress" ? "Continue Scoring" : "Start Scoring"}
              </Button>
            </Link>
          )}
          <Badge
            variant={game.status === "final" ? "default" : "outline"}
            className={
              game.status === "in_progress"
                ? "bg-primary/20 text-primary border-primary/30 animate-pulse"
                : game.status === "final"
                ? "bg-primary/20 text-primary border-primary/30"
                : "border-border/50 text-muted-foreground"
            }
          >
            {game.status === "in_progress" ? "Live" : game.status === "final" ? "Final" : "Scheduled"}
          </Badge>
        </div>
      </div>

      {/* Countdown / Game Day Banner (scheduled only) */}
      {isScheduled && daysUntil >= 0 && (
        <Card className="glass gradient-border">
          <CardContent className="p-4 flex items-center justify-center">
            <div className="text-center">
              {daysUntil === 0 ? (
                <div className="text-lg font-bold text-primary">Game Day!</div>
              ) : daysUntil === 1 ? (
                <div className="text-lg font-bold text-primary">Tomorrow</div>
              ) : (
                <div>
                  <span className="text-2xl font-extrabold text-gradient">{daysUntil}</span>
                  <span className="text-sm text-muted-foreground ml-2">days until game</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoreboard (in_progress / final only) */}
      {(game.status === "final" || game.status === "in_progress") && (
        <Card className="glass gradient-border glow-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{game.our_score}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">Padres</div>
              </div>
              <div className="text-center">
                <div className="text-gradient text-3xl font-extrabold">-</div>
                {game.innings_played > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">{game.innings_played} inn</div>
                )}
              </div>
              <div className="text-center flex-1">
                <div className="text-5xl font-extrabold tabular-nums text-gradient-bright">{game.opponent_score}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium truncate max-w-[120px] mx-auto">{game.opponent}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game Info — Editable for scheduled */}
      {isScheduled && !editingInfo && (
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Game Info</div>
              <button
                onClick={startEditInfo}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <EditPencil width={12} height={12} /> Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Opponent</div>
                <div className="font-medium">{game.opponent}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Location</div>
                <div className="font-medium">{game.location === "home" ? "Home" : "Away"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Date</div>
                <div className="font-medium">{gameDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Time</div>
                <div className="font-medium">{formatTime12(game.game_time)}</div>
              </div>
              {game.notes && (
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs">Notes</div>
                  <div className="font-medium whitespace-pre-wrap">{game.notes}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game Info — Edit Mode */}
      {isScheduled && editingInfo && (
        <Card className="glass border-primary/30">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Edit Game Info</div>
              <div className="flex gap-2">
                <button onClick={() => setEditingInfo(false)} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                  <Xmark width={12} height={12} /> Cancel
                </button>
                <button onClick={saveInfo} disabled={savingInfo} className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-medium">
                  <Check width={12} height={12} /> {savingInfo ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-opponent">Opponent</Label>
              <Input
                id="edit-opponent"
                value={editOpponent}
                onChange={(e) => setEditOpponent(e.target.value)}
                className="h-11 bg-input/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <div>
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-11 bg-input/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <div>
              <Label>Game Time</Label>
              <div className="mt-1">
                <TimePicker value={editGameTime} onChange={setEditGameTime} />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={editLocation === "home" ? "default" : "outline"}
                  onClick={() => setEditLocation("home")}
                  className={`flex-1 h-11 active:scale-95 transition-all ${editLocation === "home" ? "glow-primary" : "border-border/50"}`}
                >
                  Home
                </Button>
                <Button
                  type="button"
                  variant={editLocation === "away" ? "default" : "outline"}
                  onClick={() => setEditLocation("away")}
                  className={`flex-1 h-11 active:scale-95 transition-all ${editLocation === "away" ? "glow-primary" : "border-border/50"}`}
                >
                  Away
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Game notes, reminders..."
                className="w-full rounded-xl border border-border/50 bg-input/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none resize-none"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Venue Card — Read / Edit */}
      {isScheduled && !editingVenue && (
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Venue</div>
              <button
                onClick={startEditVenue}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <EditPencil width={12} height={12} /> {game.venue ? "Edit" : "Add"}
              </button>
            </div>
            {game.venue || game.venue_address ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {game.venue && (
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        <MapPin width={14} height={14} className="text-primary shrink-0" />
                        {game.venue}
                      </div>
                    )}
                    {game.venue_address && (
                      <div className="text-xs text-muted-foreground mt-0.5 ml-5">{game.venue_address}</div>
                    )}
                  </div>
                  {game.venue_address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(game.venue_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all active:scale-95"
                    >
                      Directions
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No venue set</div>
            )}
          </CardContent>
        </Card>
      )}

      {isScheduled && editingVenue && (
        <Card className="glass border-primary/30 relative z-10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Edit Venue</div>
              <div className="flex gap-2">
                <button onClick={() => setEditingVenue(false)} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                  <Xmark width={12} height={12} /> Cancel
                </button>
                <button onClick={saveVenue} className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-medium">
                  <Check width={12} height={12} /> Save
                </button>
              </div>
            </div>
            <VenuePicker
              venue={editVenue}
              venueAddress={editVenueAddress}
              onVenueChange={setEditVenue}
              onAddressChange={setEditVenueAddress}
            />
          </CardContent>
        </Card>
      )}

      {/* Venue Card — Non-scheduled (read-only) */}
      {!isScheduled && (game.venue || game.venue_address) && (
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                {game.venue && (
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <MapPin width={14} height={14} className="text-primary shrink-0" />
                    {game.venue}
                  </div>
                )}
                {game.venue_address && (
                  <div className="text-xs text-muted-foreground mt-0.5">{game.venue_address}</div>
                )}
              </div>
              {game.venue_address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(game.venue_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all active:scale-95"
                >
                  Directions
                </a>
              )}
            </div>
            {game.venue_address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(game.venue_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-xl overflow-hidden border border-border/30 bg-muted/20 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <MapPin width={20} height={20} />
                  Open in Google Maps
                </div>
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes — Non-scheduled (read-only) */}
      {!isScheduled && game.notes && (
        <Card className="glass">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Notes</div>
            <div className="text-sm whitespace-pre-wrap">{game.notes}</div>
          </CardContent>
        </Card>
      )}

      {/* Projected Lineup — Scheduled games */}
      {isScheduled && !editingLineup && (
        <Card className="glass">
          <CardHeader className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-gradient text-base">
                {lineup.length > 0 ? "Batting Order" : "Projected Lineup"}
              </CardTitle>
              <button
                onClick={startEditLineup}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <EditPencil width={12} height={12} /> Edit
              </button>
            </div>
            {lineup.length === 0 && (
              <p className="text-xs text-muted-foreground">Showing roster order — edit to set your lineup.</p>
            )}
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <div className="space-y-1">
              {displayLineup.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 bg-muted/20 border border-border/20"
                >
                  <span className="text-sm font-bold text-primary w-5 text-right tabular-nums">{entry.batting_order}</span>
                  <span className="text-sm font-medium flex-1">
                    <span className="text-muted-foreground mr-1">#{entry.player?.number}</span>
                    {entry.player ? fullName(entry.player) : `Player ${entry.player_id}`}
                  </span>
                  {entry.position && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {entry.position}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lineup Edit Mode */}
      {isScheduled && editingLineup && (
        <Card className="glass border-primary/30">
          <CardHeader className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Edit Lineup</CardTitle>
              <div className="flex gap-2">
                <button onClick={() => setEditingLineup(false)} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                  <Xmark width={12} height={12} /> Cancel
                </button>
                <button onClick={saveLineup} disabled={savingLineup} className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-medium">
                  <Check width={12} height={12} /> {savingLineup ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <p className="text-xs text-muted-foreground mb-3">
              Tap to select/deselect. Drag or use arrows to reorder.
            </p>
            <DndContext sensors={lineupSensors} collisionDetection={closestCenter} onDragStart={handleLineupDragStart} onDragEnd={handleLineupDragEnd}>
              <SortableContext items={selectedPlayers} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {/* Selected players in batting order */}
                  {selectedPlayers.map((playerId, orderIdx) => {
                    const player = allPlayers.find((p) => p.id === playerId);
                    if (!player) return null;
                    return (
                      <SortableLineupRow
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
                  {allPlayers.filter((p) => !selectedPlayers.includes(p.id)).map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 rounded-xl border p-2.5 transition-all cursor-pointer border-border/50 hover:border-border opacity-60"
                      onClick={() => togglePlayer(player.id)}
                    >
                      <input type="checkbox" checked={false} onChange={() => {}} className="h-4 w-4 pointer-events-none accent-primary shrink-0" />
                      <span className="font-medium flex-1 text-sm truncate">#{player.number} {fullName(player)}</span>
                    </div>
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragPlayerId ? (() => {
                  const player = allPlayers.find((p) => p.id === activeDragPlayerId);
                  if (!player) return null;
                  const orderIdx = selectedPlayers.indexOf(player.id);
                  return (
                    <div className="flex items-center gap-2 rounded-xl border-2 border-primary/60 bg-sidebar p-2.5 shadow-xl cursor-grabbing">
                      <span className="text-xs font-bold text-primary w-4 text-right">{orderIdx + 1}</span>
                      <span className="font-medium flex-1 text-sm truncate">#{player.number} {fullName(player)}</span>
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
      )}

      {/* Box Score — Our Team (in_progress / final) */}
      {lineup.length > 0 && !isScheduled && (
        <Card className="glass border-border/50">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-gradient">Our Box Score</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table className="min-w-0">
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">Player</TableHead>
                    {innings.map((inn) => (
                      <TableHead key={inn} className="text-center w-12 px-1">
                        {inn}
                      </TableHead>
                    ))}
                    <TableHead className="text-center px-2"><StatTip label="AB" /></TableHead>
                    <TableHead className="text-center px-2"><StatTip label="H" /></TableHead>
                    <TableHead className="text-center px-2"><StatTip label="RBI" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {lineup.map((entry) => {
                  const playerPAs = ourAppearances.filter((pa) => pa.player_id === entry.player_id);
                  const ab = playerPAs.filter((pa) => pa.is_at_bat).length;
                  const h = playerPAs.filter((pa) => pa.is_hit).length;
                  const rbi = playerPAs.reduce((sum, pa) => sum + pa.rbis, 0);

                  return (
                    <TableRow key={entry.id} className="border-border/30">
                      <TableCell className="sticky left-0 bg-card z-10">
                        <Link href={`/players/${entry.player_id}`} className="hover:text-primary font-medium transition-colors">
                          <span className="text-muted-foreground mr-1">{entry.batting_order}.</span>
                          {entry.player ? fullName(entry.player) : `Player ${entry.player_id}`}
                        </Link>
                      </TableCell>
                      {innings.map((inn) => {
                        const innPAs = playerPAs.filter((pa) => pa.inning === inn);
                        return (
                          <TableCell key={inn} className="text-center text-xs sm:text-sm px-1 whitespace-nowrap">
                            {innPAs.map((pa) => pa.scorebook_notation || pa.result).join(", ") || ""}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center tabular-nums">{ab}</TableCell>
                      <TableCell className="text-center font-bold text-primary tabular-nums">{h}</TableCell>
                      <TableCell className="text-center tabular-nums">{rbi}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Score — Opponent */}
      {opponentLineup.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-gradient">Opponent Box Score</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table className="min-w-0">
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">Batter</TableHead>
                    {innings.map((inn) => (
                      <TableHead key={inn} className="text-center w-12 px-1">
                        {inn}
                      </TableHead>
                    ))}
                    <TableHead className="text-center px-2"><StatTip label="AB" /></TableHead>
                    <TableHead className="text-center px-2"><StatTip label="H" /></TableHead>
                    <TableHead className="text-center px-2"><StatTip label="RBI" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {opponentLineup.map((entry) => {
                  const batterPAs = oppAppearances.filter((pa) => pa.opponent_batter_id === entry.id);
                  const ab = batterPAs.filter((pa) => pa.is_at_bat).length;
                  const h = batterPAs.filter((pa) => pa.is_hit).length;
                  const rbi = batterPAs.reduce((sum, pa) => sum + pa.rbis, 0);

                  return (
                    <TableRow key={entry.id} className="border-border/30">
                      <TableCell className="sticky left-0 bg-card z-10">
                        <span className="text-muted-foreground mr-1">{entry.batting_order}.</span>
                        <span className="font-medium">{entry.name}</span>
                      </TableCell>
                      {innings.map((inn) => {
                        const innPAs = batterPAs.filter((pa) => pa.inning === inn);
                        return (
                          <TableCell key={inn} className="text-center text-xs sm:text-sm px-1 whitespace-nowrap">
                            {innPAs.map((pa) => pa.scorebook_notation || pa.result).join(", ") || ""}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center tabular-nums">{ab}</TableCell>
                      <TableCell className="text-center font-bold text-primary tabular-nums">{h}</TableCell>
                      <TableCell className="text-center tabular-nums">{rbi}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
