"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VenuePicker } from "@/components/venue-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash, Check } from "iconoir-react";
import type { Game, Practice } from "@/lib/scoring/types";

type ScheduleItem =
  | { kind: "game"; date: string; data: Game }
  | { kind: "practice"; date: string; data: Practice };

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Filter = "all" | "games" | "practices";

export default function SchedulePage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  // Select / delete mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [selectedPractices, setSelectedPractices] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "game"; data: Game } | { kind: "practice"; data: Practice } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Log practice form
  const [showNewPractice, setShowNewPractice] = useState(false);
  const [newTitle, setNewTitle] = useState("Practice");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newVenue, setNewVenue] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const [gamesRes, practicesRes] = await Promise.all([
        supabase.from("games").select("*"),
        supabase.from("practices").select("*"),
      ]);
      setGames(gamesRes.data ?? []);
      setPractices(practicesRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Build unified items list sorted by date (upcoming first, then past)
  const items: ScheduleItem[] = [];
  if (filter !== "practices") {
    for (const g of games) {
      items.push({ kind: "game", date: g.date, data: g });
    }
  }
  if (filter !== "games") {
    for (const p of practices) {
      items.push({ kind: "practice", date: p.date, data: p });
    }
  }

  // Sort: scheduled/upcoming first (ascending), then past (descending)
  const today = new Date().toISOString().split("T")[0];
  items.sort((a, b) => {
    const aUpcoming = a.date >= today ? 0 : 1;
    const bUpcoming = b.date >= today ? 0 : 1;
    if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
    if (aUpcoming === 0) {
      // Both upcoming: soonest first
      return a.date.localeCompare(b.date);
    }
    // Both past: most recent first
    return b.date.localeCompare(a.date);
  });

  // Group by month
  const grouped = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const d = new Date(item.date + "T12:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Delete handlers
  async function handleDeleteGame(game: Game) {
    setDeleting(true);
    const gameId = game.id;
    await supabase.from("fielding_plays").delete().eq("game_id", gameId);
    await supabase.from("plate_appearances").delete().eq("game_id", gameId);
    await supabase.from("game_state").delete().eq("game_id", gameId);
    await supabase.from("opponent_lineup").delete().eq("game_id", gameId);
    await supabase.from("game_lineup").delete().eq("game_id", gameId);
    await supabase.from("games").delete().eq("id", gameId);
    setGames((prev) => prev.filter((g) => g.id !== gameId));
    setDeleteTarget(null);
    setDeleting(false);
  }

  async function handleDeletePractice(practice: Practice) {
    setDeleting(true);
    await supabase.from("practices").delete().eq("id", practice.id);
    setPractices((prev) => prev.filter((p) => p.id !== practice.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  function handleDeleteSelected() {
    // Delete first selected item (one at a time via confirmation dialog)
    if (selectedGames.size > 0) {
      const gameId = Array.from(selectedGames)[0];
      const game = games.find((g) => g.id === gameId);
      if (game) {
        setDeleteTarget({ kind: "game", data: game });
        return;
      }
    }
    if (selectedPractices.size > 0) {
      const practiceId = Array.from(selectedPractices)[0];
      const practice = practices.find((p) => p.id === practiceId);
      if (practice) {
        setDeleteTarget({ kind: "practice", data: practice });
        return;
      }
    }
  }

  function toggleSelectGame(id: string) {
    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectPractice(id: string) {
    setSelectedPractices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedGames(new Set());
    setSelectedPractices(new Set());
  }

  // Create practice
  async function handleCreatePractice() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("practices")
      .insert({
        title: newTitle.trim(),
        date: newDate,
        venue: newVenue.trim() || null,
        venue_address: newVenueAddress.trim() || null,
      })
      .select()
      .single();
    if (data && !error) {
      router.push(`/practices/${data.id}`);
    } else {
      alert("Failed to create practice: " + (error?.message ?? "Unknown error"));
      setCreating(false);
    }
  }

  // After deleting from dialog, also remove from selected sets
  function onDeleteConfirm() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "game") {
      handleDeleteGame(deleteTarget.data as Game).then(() => {
        selectedGames.delete((deleteTarget.data as Game).id);
        setSelectedGames(new Set(selectedGames));
        // If more selected, trigger next
        setTimeout(() => handleDeleteSelected(), 100);
      });
    } else {
      handleDeletePractice(deleteTarget.data as Practice).then(() => {
        selectedPractices.delete((deleteTarget.data as Practice).id);
        setSelectedPractices(new Set(selectedPractices));
        setTimeout(() => handleDeleteSelected(), 100);
      });
    }
  }

  const totalSelected = selectedGames.size + selectedPractices.size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">Schedule</h1>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              {totalSelected > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9"
                  onClick={handleDeleteSelected}
                >
                  Delete ({totalSelected})
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-9 border-border/50" onClick={exitSelectMode}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border/50 text-muted-foreground"
                onClick={() => setSelectMode(true)}
              >
                Select
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border/50"
                onClick={() => setShowNewPractice(!showNewPractice)}
              >
                {showNewPractice ? "Cancel" : "Log Practice"}
              </Button>
              <Link href="/games/new">
                <Button size="sm" className="h-9 glow-primary">New Game</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href="/practices/drills"
          className="flex-1 rounded-xl border-2 border-border/50 bg-muted/30 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <div className="font-semibold text-sm group-hover:text-primary transition-colors">Drill Library</div>
          <div className="text-xs text-muted-foreground">Create & manage drills</div>
        </Link>
        <Link
          href="/practices/templates"
          className="flex-1 rounded-xl border-2 border-border/50 bg-muted/30 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <div className="font-semibold text-sm group-hover:text-primary transition-colors">Plan Templates</div>
          <div className="text-xs text-muted-foreground">Pre-built practice plans</div>
        </Link>
      </div>

      {/* Log practice form */}
      {showNewPractice && (
        <Card className="glass animate-slide-up">
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Practice"
                className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Date</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-12 text-base w-full bg-input/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Location</label>
              <div className="mt-1">
                <VenuePicker
                  venue={newVenue}
                  venueAddress={newVenueAddress}
                  onVenueChange={setNewVenue}
                  onAddressChange={setNewVenueAddress}
                />
              </div>
            </div>
            <Button
              className="w-full h-12 text-base font-bold glow-primary active:scale-[0.98] transition-transform"
              onClick={handleCreatePractice}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? "Creating..." : "Start Practice Log"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/30">
        {(["all", "games", "practices"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              filter === f
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f === "games" ? "Games" : "Practices"}
          </button>
        ))}
      </div>

      {/* Schedule items grouped by month */}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {filter === "games"
            ? "No games yet. Create your first game!"
            : filter === "practices"
            ? "No practices logged yet."
            : "Nothing scheduled yet."}
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([monthKey, monthItems]) => {
            const [year, monthIdx] = monthKey.split("-").map(Number);
            const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;
            return (
              <div key={monthKey}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                  {monthLabel}
                </h2>
                <div className="space-y-2">
                  {monthItems.map((item) => {
                    if (item.kind === "game") {
                      return (
                        <GameRow
                          key={`game-${item.data.id}`}
                          game={item.data as Game}
                          selectMode={selectMode}
                          selected={selectedGames.has(item.data.id)}
                          onToggleSelect={() => toggleSelectGame(item.data.id)}
                          onDelete={() => setDeleteTarget({ kind: "game", data: item.data as Game })}
                        />
                      );
                    }
                    return (
                      <PracticeRow
                        key={`practice-${item.data.id}`}
                        practice={item.data as Practice}
                        selectMode={selectMode}
                        selected={selectedPractices.has(item.data.id)}
                        onToggleSelect={() => toggleSelectPractice(item.data.id)}
                        onDelete={() => setDeleteTarget({ kind: "practice", data: item.data as Practice })}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete {deleteTarget?.kind === "game" ? "Game" : "Practice"}
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="space-y-2">
                {deleteTarget.kind === "game" ? (
                  <>
                    <p className="text-sm text-foreground">
                      Are you sure you want to delete the game against{" "}
                      <span className="font-bold">{(deleteTarget.data as Game).opponent}</span> on{" "}
                      <span className="font-bold">
                        {new Date((deleteTarget.data as Game).date + "T00:00:00").toLocaleDateString()}
                      </span>?
                    </p>
                    <p className="text-sm text-destructive font-medium">
                      This cannot be undone. All plate appearances, fielding plays, and player stats from this game will be permanently removed.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-foreground">
                      Are you sure you want to delete{" "}
                      <span className="font-bold">{(deleteTarget.data as Practice).title}</span> on{" "}
                      <span className="font-bold">
                        {new Date((deleteTarget.data as Practice).date + "T00:00:00").toLocaleDateString()}
                      </span>?
                    </p>
                    <p className="text-sm text-destructive font-medium">
                      This cannot be undone. All practice data will be permanently removed.
                    </p>
                  </>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDeleteConfirm}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Game row component ===

function GameRow({
  game,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
}: {
  game: Game;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const d = new Date(game.date + "T12:00:00");
  const dayAbbr = DAY_ABBR[d.getDay()];
  const dayNum = d.getDate();
  const opponentLabel = game.location === "away" ? `@ ${game.opponent}` : `vs ${game.opponent}`;
  const today = new Date().toISOString().split("T")[0];
  const isPast = game.date < today;
  const isCompleted = game.status === "final" || isPast;

  const content = (
    <Card className={`card-hover glass ${selected ? "ring-2 ring-primary/50" : ""}`}>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        {/* Select checkbox */}
        {selectMode && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              selected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-border/60 hover:border-primary/50"
            }`}
          >
            {selected && <Check width={14} height={14} />}
          </button>
        )}

        {/* Completed checkmark */}
        {isCompleted && (
          <div className="h-5 w-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
            <Check width={12} height={12} className="text-green-400" />
          </div>
        )}

        {/* Day column */}
        <div className="w-12 shrink-0 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight">
            {dayAbbr}
          </div>
          <div className="text-2xl font-extrabold leading-tight tabular-nums">
            {dayNum}
          </div>
        </div>

        {/* Opponent + venue */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base truncate">{opponentLabel}</div>
          {game.venue && (
            <div className="text-xs text-muted-foreground truncate">{game.venue}</div>
          )}
        </div>

        {/* Time + status */}
        <div className="flex items-center gap-2 shrink-0">
          {game.game_time && (
            <span className="text-sm text-muted-foreground tabular-nums">{game.game_time}</span>
          )}
          {game.status === "final" ? (
            <>
              <span className="text-sm font-bold tabular-nums">
                {game.our_score}-{game.opponent_score}
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

        {/* Delete button in select mode */}
        {selectMode && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          >
            <Trash width={16} height={16} />
          </button>
        )}
      </CardContent>
    </Card>
  );

  if (selectMode) return <div>{content}</div>;
  return <Link href={`/games/${game.id}`}>{content}</Link>;
}

// === Practice row component ===

function PracticeRow({
  practice,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
}: {
  practice: Practice;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const d = new Date(practice.date + "T12:00:00");
  const dayAbbr = DAY_ABBR[d.getDay()];
  const dayNum = d.getDate();
  const today = new Date().toISOString().split("T")[0];
  const isPast = practice.date < today;
  const isCompleted = practice.completed || isPast;

  const content = (
    <Card className={`card-hover glass ${selected ? "ring-2 ring-primary/50" : ""}`}>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        {/* Select checkbox */}
        {selectMode && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              selected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-border/60 hover:border-primary/50"
            }`}
          >
            {selected && <Check width={14} height={14} />}
          </button>
        )}

        {/* Completed checkmark */}
        {isCompleted && (
          <div className="h-5 w-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
            <Check width={12} height={12} className="text-green-400" />
          </div>
        )}

        {/* Day column */}
        <div className="w-12 shrink-0 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight">
            {dayAbbr}
          </div>
          <div className="text-2xl font-extrabold leading-tight tabular-nums">
            {dayNum}
          </div>
        </div>

        {/* Title + venue */}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-base truncate">{practice.title}</span>
          {practice.venue && (
            <div className="text-xs text-muted-foreground truncate">{practice.venue}</div>
          )}
        </div>

        {/* Practice badge */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="border-border/50 text-muted-foreground bg-muted/30">
            Practice
          </Badge>
        </div>

        {/* Delete button in select mode */}
        {selectMode && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          >
            <Trash width={16} height={16} />
          </button>
        )}
      </CardContent>
    </Card>
  );

  if (selectMode) return <div>{content}</div>;
  return <Link href={`/practices/${practice.id}`}>{content}</Link>;
}
