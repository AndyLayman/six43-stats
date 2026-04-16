"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/rich-editor";
import type {
  Practice, PracticeNote, Player, Drill,
  PracticePlanItem, ActionItem, PracticeAttendance,
  SquadGroup, SquadMember,
} from "@/lib/scoring/types";
import { fullName, firstName } from "@/lib/player-name";
import { CustomSelect } from "@/components/custom-select";
import { useAuth } from "@/components/auth-provider";
import { ChainAwardPicker } from "@/components/chain-award-picker";
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
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { NavArrowLeft, ShareIos, NavArrowDown, NavArrowRight, Xmark, Check, Group, DoubleCheck } from 'iconoir-react';

function DraggablePlayer({ player, color }: { player: Player; color: { bg: string; text: string; border: string } }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `player-${player.id}`,
    data: { playerId: player.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`h-8 px-2 rounded-lg text-xs font-bold ${color.border} ${color.bg} ${color.text} border transition-all select-none cursor-grab active:cursor-grabbing touch-manipulation truncate flex items-center ${isDragging ? "opacity-30" : ""}`}
    >
      #{player.number} {firstName(player)}
    </div>
  );
}

function DroppablePlayerGroup({ groupId, children, color }: { groupId: string; children: React.ReactNode; color: { bg: string; text: string; border: string } }) {
  const { isOver, setNodeRef } = useDroppable({ id: `squad-${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 ${color.border} ${color.bg} p-2.5 flex flex-col transition-all ${isOver ? "ring-2 ring-primary/50 scale-[1.02]" : ""}`}
    >
      {children}
    </div>
  );
}

const FOCUS_AREAS = ["Hitting", "Fielding", "Throwing", "Baserunning", "Attitude", "Other"];

function isEmptyHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export default function LivePracticePage() {
  const params = useParams();
  const router = useRouter();
  const practiceId = params.practiceId as string;
  const { activeTeam } = useAuth();

  const [practice, setPractice] = useState<Practice | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan items + drill details
  const [planItems, setPlanItems] = useState<PracticePlanItem[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedGroupDrill, setExpandedGroupDrill] = useState<string | null>(null);

  // Attendance
  const [attendance, setAttendance] = useState<Map<number, boolean>>(new Map());
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);

  // Notes
  const [notes, setNotes] = useState<PracticeNote[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [focusArea, setFocusArea] = useState<string | null>(null);
  const [teamNotes, setTeamNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [openActionItems, setOpenActionItems] = useState<ActionItem[]>([]);
  const [newActionText, setNewActionText] = useState("");
  const [newActionPlayer, setNewActionPlayer] = useState<number | null>(null);

  // Squad groups
  const [squadGroups, setSquadGroups] = useState<SquadGroup[]>([]);
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [squadAutoAssigned, setSquadAutoAssigned] = useState(false);
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<number | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const GROUP_COLORS = [
    { bg: "bg-primary/20", text: "text-primary", border: "border-primary/40" },
    { bg: "bg-primary/15", text: "text-primary/80", border: "border-primary/30" },
    { bg: "bg-primary/10", text: "text-primary/70", border: "border-primary/25" },
    { bg: "bg-primary/20", text: "text-primary", border: "border-primary/40" },
    { bg: "bg-primary/15", text: "text-primary/80", border: "border-primary/30" },
    { bg: "bg-primary/10", text: "text-primary/70", border: "border-primary/25" },
  ];

  // Share
  const [shareMessage, setShareMessage] = useState("");

  // End practice
  const [showEndSummary, setShowEndSummary] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!activeTeam) return;
    async function load() {
      const [practiceRes, playersRes, planRes, drillsRes, attendanceRes, notesRes, actionRes, openActionRes, groupsRes, membersRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).eq("team_id", activeTeam!.team_id).single(),
        supabase.from("players").select("*").eq("team_id", activeTeam!.team_id).order("sort_order"),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("drills").select("*").eq("team_id", activeTeam!.team_id).order("name"),
        supabase.from("practice_attendance").select("*").eq("practice_id", practiceId),
        supabase.from("practice_notes").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("action_items").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("action_items").select("*").is("completed", false).is("practice_id", null).order("created_at"),
        supabase.from("practice_squad_groups").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_squad_members").select("*"),
      ]);

      setPractice(practiceRes.data);
      setPlayers(playersRes.data ?? []);
      setPlanItems(planRes.data ?? []);
      setDrills(drillsRes.data ?? []);
      setTeamNotes(practiceRes.data?.notes ?? "");
      setNotes(notesRes.data ?? []);
      setActionItems(actionRes.data ?? []);
      setOpenActionItems(openActionRes.data ?? []);

      const groups = (groupsRes.data ?? []) as SquadGroup[];
      setSquadGroups(groups);
      // Filter members to only those belonging to this practice's groups
      const groupIds = new Set(groups.map((g) => g.id));
      const filteredMembers = ((membersRes.data ?? []) as SquadMember[]).filter((m) => groupIds.has(m.group_id));
      setSquadMembers(filteredMembers);
      if (filteredMembers.length > 0) setSquadAutoAssigned(true);

      const attMap = new Map<number, boolean>();
      for (const a of (attendanceRes.data ?? []) as PracticeAttendance[]) {
        attMap.set(a.player_id, a.present);
      }

      // Auto-populate attendance: fill in any players without a row as present
      const allPlayers = playersRes.data ?? [];
      const missing = allPlayers.filter((p: Player) => !attMap.has(p.id));
      if (missing.length > 0) {
        const rows = missing.map((p: Player) => ({ practice_id: practiceId, player_id: p.id, present: true }));
        await supabase.from("practice_attendance").insert(rows);
        for (const p of missing) {
          attMap.set(p.id, true);
        }
      }

      setAttendance(attMap);
      setAttendanceLoaded(true);
      setLoading(false);
    }
    load();
  }, [practiceId, activeTeam]);

  // ---- Attendance ----
  async function toggleAttendance(playerId: number) {
    const current = attendance.get(playerId);
    const newVal = current === undefined ? true : !current;
    const newMap = new Map(attendance);
    newMap.set(playerId, newVal);
    setAttendance(newMap);

    if (current === undefined) {
      await supabase.from("practice_attendance").insert({ practice_id: practiceId, player_id: playerId, present: newVal });
    } else {
      await supabase.from("practice_attendance").update({ present: newVal }).eq("practice_id", practiceId).eq("player_id", playerId);
    }
  }

  // ---- Plan Items ----
  async function togglePlanItem(id: string, completed: boolean) {
    setPlanItems(planItems.map((i) => (i.id === id ? { ...i, completed } : i)));
    await supabase.from("practice_plan_items").update({ completed }).eq("id", id);
  }

  function getDrill(drillId: string | null): Drill | undefined {
    if (!drillId) return undefined;
    return drills.find((d) => d.id === drillId);
  }

  // ---- Notes ----
  async function handleAddNote() {
    if (!selectedPlayer || isEmptyHtml(noteText)) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("practice_notes")
      .insert({ practice_id: practiceId, player_id: selectedPlayer, note: noteText.trim(), focus_area: focusArea })
      .select()
      .single();
    if (data && !error) {
      setNotes([...notes, data]);
      setNoteText("");
      setFocusArea(null);
      setSelectedPlayer(null);
    }
    setSaving(false);
  }

  async function handleSaveTeamNotes() {
    await supabase.from("practices").update({ notes: teamNotes.trim() || null }).eq("id", practiceId);
  }

  async function handleDeleteNote(noteId: string) {
    await supabase.from("practice_notes").delete().eq("id", noteId);
    setNotes(notes.filter((n) => n.id !== noteId));
  }

  // ---- Action Items ----
  async function addActionItem() {
    if (!newActionText.trim()) return;
    const { data } = await supabase
      .from("action_items")
      .insert({ team_id: activeTeam!.team_id, practice_id: practiceId, player_id: newActionPlayer, text: newActionText.trim(), completed: false })
      .select()
      .single();
    if (data) {
      setActionItems([...actionItems, data]);
      setNewActionText("");
      setNewActionPlayer(null);
    }
  }

  async function toggleActionItem(item: ActionItem) {
    const newCompleted = !item.completed;
    if (item.practice_id === practiceId) {
      setActionItems(actionItems.map((a) => (a.id === item.id ? { ...a, completed: newCompleted } : a)));
    } else {
      setOpenActionItems(openActionItems.map((a) => (a.id === item.id ? { ...a, completed: newCompleted } : a)));
    }
    await supabase.from("action_items").update({ completed: newCompleted }).eq("id", item.id);
  }

  async function deleteActionItem(id: string) {
    setActionItems(actionItems.filter((a) => a.id !== id));
    setOpenActionItems(openActionItems.filter((a) => a.id !== id));
    await supabase.from("action_items").delete().eq("id", id);
  }

  // ---- Share ----
  async function handleShare() {
    const shareUrl = `${window.location.origin}/practices/${practiceId}/share`;
    const title = `${practice?.title} — ${new Date(practice!.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Link copied!");
      setTimeout(() => setShareMessage(""), 2000);
    } catch {
      setShareMessage("Could not share");
      setTimeout(() => setShareMessage(""), 2000);
    }
  }

  // ---- Squad Split ----
  const hasSquadSplit = planItems.some((i) => i.label === "Squad Split" && !i.drill_id);

  async function autoAssignPlayers() {
    if (squadGroups.length === 0) return;
    // Get present players
    const presentPlayers = players.filter((p) => attendance.get(p.id) === true);
    if (presentPlayers.length === 0) return;

    // Clear existing members for these groups
    const groupIds = squadGroups.map((g) => g.id);
    for (const gid of groupIds) {
      await supabase.from("practice_squad_members").delete().eq("group_id", gid);
    }

    // Round-robin distribute
    const newMembers: SquadMember[] = [];
    for (let i = 0; i < presentPlayers.length; i++) {
      const group = squadGroups[i % squadGroups.length];
      const { data } = await supabase
        .from("practice_squad_members")
        .insert({ group_id: group.id, player_id: presentPlayers[i].id })
        .select()
        .single();
      if (data) newMembers.push(data);
    }
    setSquadMembers(newMembers);
    setSquadAutoAssigned(true);
  }

  async function movePlayerToGroup(playerId: number, newGroupId: string) {
    const existing = squadMembers.find((m) => m.player_id === playerId);
    if (existing) {
      if (existing.group_id === newGroupId) return;
      await supabase.from("practice_squad_members").delete().eq("id", existing.id);
    }
    const { data } = await supabase
      .from("practice_squad_members")
      .insert({ group_id: newGroupId, player_id: playerId })
      .select()
      .single();
    if (data) {
      setSquadMembers([...squadMembers.filter((m) => m.player_id !== playerId), data]);
    }
  }

  function handleSquadDragStart(event: DragStartEvent) {
    setActiveDragPlayerId(event.active.data.current?.playerId as number);
  }

  async function handleSquadDragEnd(event: DragEndEvent) {
    setActiveDragPlayerId(null);
    const { active, over } = event;
    if (!over) return;
    const playerId = active.data.current?.playerId as number;
    const overId = over.id as string;
    if (overId.startsWith("squad-")) {
      const groupId = overId.replace("squad-", "");
      await movePlayerToGroup(playerId, groupId);
    }
  }

  if (loading || !practice) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const notesByPlayer = new Map<number, PracticeNote[]>();
  for (const n of notes) {
    const arr = notesByPlayer.get(n.player_id) ?? [];
    arr.push(n);
    notesByPlayer.set(n.player_id, arr);
  }

  const presentCount = [...attendance.values()].filter(Boolean).length;
  const absentCount = [...attendance.values()].filter((v) => v === false).length;
  const totalPlanMinutes = planItems.reduce((s, i) => s + i.duration_minutes, 0);
  const completedCount = planItems.filter((i) => i.completed).length;
  const actionCompletedCount = actionItems.filter((a) => a.completed).length;

  async function endPractice() {
    setEnding(true);
    await supabase.from("practices").update({ completed: true }).eq("id", practiceId);
    setEnding(false);
    router.push(`/practices/${practiceId}/share`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <Link href={`/practices/${practiceId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
          <NavArrowLeft width="16" height="16" />
          Setup
        </Link>
        <div className="flex items-center gap-2">
          {shareMessage && <span className="text-xs text-primary animate-slide-up">{shareMessage}</span>}
          <Button variant="outline" className="h-9 text-xs border-border/50 gap-1.5" onClick={handleShare}>
            <ShareIos width="14" height="14" />
            Share Plan
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Live Practice</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient mt-1">{practice.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(practice.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          {practice.venue ? ` · ${practice.venue}` : ""}
        </p>
      </div>

      {/* Attendance */}
      <Card className="glass">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium flex items-center justify-between">
            <span>Attendance</span>
            {attendanceLoaded && attendance.size > 0 && (
              <span className="text-xs normal-case font-normal">
                {presentCount} present{absentCount > 0 ? ` · ${absentCount} absent` : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {players.map((p) => {
              const status = attendance.get(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleAttendance(p.id)}
                  className={`h-10 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 select-none truncate px-1 ${
                    status === true
                      ? "bg-primary/15 text-primary border-primary/30"
                      : status === false
                      ? "bg-muted/10 text-muted-foreground/40 border-border/30 line-through"
                      : "bg-muted/30 text-foreground border-border/50"
                  }`}
                >
                  #{p.number} {firstName(p)}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Tap: present, tap again: absent, tap again: reset.</p>
        </CardContent>
      </Card>

      {/* Practice Plan — full details */}
      {planItems.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium flex items-center justify-between">
              <span>Practice Plan</span>
              <span className="text-xs normal-case font-normal">
                {completedCount}/{planItems.length} done &middot; {totalPlanMinutes} min
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {planItems.filter((i) => !i.group_id).map((item, idx) => {
              const drill = getDrill(item.drill_id);
              const isExpanded = expandedItem === item.id;
              const isSquadSplit = item.label === "Squad Split" && !item.drill_id;

              return (
                <div key={item.id} className="rounded-xl border-2 border-border/50 bg-muted/10 overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => !isSquadSplit && setExpandedItem(isExpanded ? null : item.id)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePlanItem(item.id, !item.completed); }}
                      className={`h-7 w-7 rounded-lg border-2 shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                        item.completed
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {item.completed ? (
                        <Check width="14" height="14" />
                      ) : (
                        idx + 1
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold flex items-center gap-1.5 ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                        {isSquadSplit && (
                          <Group width="14" height="14" className="text-primary shrink-0" />
                        )}
                        {item.label}
                      </div>
                      {!isSquadSplit && (
                        <div className="text-xs text-muted-foreground">
                          {item.duration_minutes} min{drill?.category ? ` · ${drill.category}` : ""}
                        </div>
                      )}
                      {isSquadSplit && (
                        <div className="text-xs text-muted-foreground">
                          {squadGroups.length} group{squadGroups.length !== 1 ? "s" : ""} · {squadMembers.length} player{squadMembers.length !== 1 ? "s" : ""} assigned
                        </div>
                      )}
                    </div>
                    {drill && (
                      <NavArrowDown
                        width="16"
                        height="16"
                        className={`shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    )}
                  </div>

                  {/* Expanded drill details */}
                  {isExpanded && drill?.description && !isEmptyHtml(drill.description) && (
                    <div className="px-4 pb-4 pt-0 border-t border-border/30">
                      <div
                        className="text-sm prose prose-invert prose-sm max-w-none mt-3"
                        dangerouslySetInnerHTML={{ __html: drill.description }}
                      />
                    </div>
                  )}

                  {/* Squad Split — groups with players and drills */}
                  {isSquadSplit && squadGroups.length > 0 && (
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={handleSquadDragStart} onDragEnd={handleSquadDragEnd}>
                      <div className="px-3 pb-3 border-t border-border/30 pt-3 space-y-3">
                        <Button
                          variant="outline"
                          className="w-full h-9 text-xs font-bold border-primary/30 text-primary disabled:opacity-40"
                          onClick={autoAssignPlayers}
                          disabled={presentCount === 0}
                        >
                          {squadAutoAssigned
                            ? "Re-shuffle Players"
                            : presentCount > 0
                            ? `Auto-Assign ${presentCount} Present Players`
                            : "Auto-Assign Players (mark attendance first)"}
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          {squadGroups.map((group) => {
                            const color = GROUP_COLORS[group.color_index % GROUP_COLORS.length];
                            const groupDrills = planItems.filter((i) => i.group_id === group.id);
                            const groupPlayers = squadMembers
                              .filter((m) => m.group_id === group.id)
                              .map((m) => players.find((p) => p.id === m.player_id))
                              .filter((p): p is Player => !!p);

                            return (
                              <DroppablePlayerGroup key={group.id} groupId={group.id} color={color}>
                                <div className={`text-xs font-bold ${color.text} mb-2`}>{group.name}</div>

                                {/* Drills in this group */}
                                {groupDrills.length > 0 && (
                                  <div className="space-y-1 mb-2">
                                    {groupDrills.map((gi) => {
                                      const giDrill = getDrill(gi.drill_id);
                                      const isGiExpanded = expandedGroupDrill === gi.id;
                                      return (
                                        <div key={gi.id}>
                                          <button
                                            onClick={() => setExpandedGroupDrill(isGiExpanded ? null : gi.id)}
                                            className={`w-full text-left text-[10px] font-medium ${color.text} opacity-80 flex items-center gap-1 hover:opacity-100 transition-opacity`}
                                          >
                                            <NavArrowRight width={10} height={10} className={`shrink-0 transition-transform ${isGiExpanded ? "rotate-90" : ""}`} />
                                            <span className="truncate">{gi.label}{gi.duration_minutes > 0 ? ` (${gi.duration_minutes}m)` : ""}</span>
                                          </button>
                                          {isGiExpanded && giDrill?.description && !isEmptyHtml(giDrill.description) && (
                                            <div
                                              className="mt-1 ml-3 text-[10px] text-muted-foreground prose prose-invert max-w-none"
                                              dangerouslySetInnerHTML={{ __html: giDrill.description }}
                                            />
                                          )}
                                          {isGiExpanded && (!giDrill?.description || isEmptyHtml(giDrill.description ?? "")) && (
                                            <p className="mt-1 ml-3 text-[10px] text-muted-foreground italic">No description.</p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Players in this group */}
                                <div className="flex flex-col gap-1 min-h-[2rem]">
                                  {groupPlayers.map((p) => (
                                    <DraggablePlayer key={p.id} player={p} color={color} />
                                  ))}
                                  {groupPlayers.length === 0 && (
                                    <span className="text-[10px] text-muted-foreground italic">No players yet</span>
                                  )}
                                </div>
                              </DroppablePlayerGroup>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Drag players between groups to adjust.</p>
                      </div>

                      <DragOverlay>
                        {activeDragPlayerId ? (() => {
                          const p = players.find((pl) => pl.id === activeDragPlayerId);
                          if (!p) return null;
                          return (
                            <div className="h-8 px-2 rounded-lg text-xs font-bold border-2 border-primary/60 bg-primary/20 text-primary shadow-lg cursor-grabbing flex items-center">
                              #{p.number} {firstName(p)}
                            </div>
                          );
                        })() : null}
                      </DragOverlay>
                    </DndContext>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Carry-Forward Action Items */}
      {openActionItems.length > 0 && (
        <Card className="glass border-primary/30">
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm text-primary uppercase tracking-wider font-medium">
              Open Action Items (from previous)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1">
              {openActionItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleActionItem(item)}
                    className={`h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                      item.completed
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "border-primary/40 hover:border-primary/60"
                    }`}
                  >
                    {item.completed && (
                      <Check width="12" height="12" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.text}
                  </span>
                  {item.player_id && (
                    <span className="text-xs text-muted-foreground">
                      #{players.find((p) => p.id === item.player_id)?.number}
                    </span>
                  )}
                  <button
                    onClick={() => deleteActionItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <Xmark width="14" height="14" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Notes */}
      <Card className="glass">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Team Notes</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <RichEditor
            content={teamNotes}
            onChange={(html) => setTeamNotes(html)}
            placeholder="Overall practice notes, drills run, focus for the day... Type @ to tag a player."
            mentions={players.map((p) => ({ id: p.id.toString(), label: `#${p.number} ${fullName(p)}` }))}
          />
          <Button
            variant="outline"
            className="mt-2 h-9 text-xs font-semibold border-border/50"
            onClick={handleSaveTeamNotes}
          >
            Save Notes
          </Button>
        </CardContent>
      </Card>

      {/* Add Player Note */}
      <Card className="glass gradient-border">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-gradient uppercase tracking-wider font-medium">Add Player Note</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(selectedPlayer === p.id ? null : p.id)}
                className={`h-10 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 select-none truncate px-1 ${
                  selectedPlayer === p.id
                    ? "bg-primary/20 text-primary border-primary/40 shadow-md"
                    : "bg-muted/30 text-foreground border-border/50"
                }`}
              >
                #{p.number} {firstName(p)}
              </button>
            ))}
          </div>

          {selectedPlayer && (
            <>
              <div className="flex gap-2 flex-wrap">
                {FOCUS_AREAS.map((area) => (
                  <button
                    key={area}
                    onClick={() => setFocusArea(focusArea === area ? null : area)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 select-none ${
                      focusArea === area
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-muted/30 text-muted-foreground border-border/50"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>

              <RichEditor
                content={noteText}
                onChange={(html) => setNoteText(html)}
                placeholder={`Notes for ${(() => { const p = players.find((p) => p.id === selectedPlayer); return p ? fullName(p) : ""; })()}... Type @ to tag players.`}
                autofocus
                mentions={players.map((p) => ({ id: p.id.toString(), label: `#${p.number} ${fullName(p)}` }))}
              />

              <Button
                className="w-full h-11 text-sm font-bold glow-primary active:scale-[0.98] transition-transform"
                onClick={handleAddNote}
                disabled={saving || isEmptyHtml(noteText)}
              >
                {saving ? "Saving..." : "Add Note"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card className="glass overflow-visible relative z-10">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium flex items-center justify-between">
            <span>Action Items</span>
            {actionItems.length > 0 && (
              <span className="text-xs normal-case font-normal">
                {actionItems.filter((a) => a.completed).length}/{actionItems.length} done
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3 overflow-visible">
          {actionItems.length > 0 && (
            <div className="space-y-1">
              {actionItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleActionItem(item)}
                    className={`h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                      item.completed
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "border-border/50 hover:border-primary/40"
                    }`}
                  >
                    {item.completed && (
                      <Check width="12" height="12" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.text}
                  </span>
                  {item.player_id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                      #{players.find((p) => p.id === item.player_id)?.number}
                    </span>
                  )}
                  <button
                    onClick={() => deleteActionItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <Xmark width="14" height="14" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                placeholder="New action item..."
                className="h-9 text-sm bg-input/50 border-border/50"
                onKeyDown={(e) => e.key === "Enter" && addActionItem()}
              />
            </div>
            <CustomSelect
              value={newActionPlayer?.toString() ?? ""}
              onChange={(val) => setNewActionPlayer(val ? parseInt(val) : null)}
              options={[{ value: "", label: "Team" }, ...players.map((p) => ({ value: p.id.toString(), label: `#${p.number} ${firstName(p)}` }))]}
              placeholder="Team"
              className="h-9 w-28"
            />
            <Button variant="outline" className="h-9 text-xs shrink-0" onClick={addActionItem} disabled={!newActionText.trim()}>
              Add
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Uncompleted items carry forward to future practices.</p>
        </CardContent>
      </Card>

      {/* Chain Awards */}
      <Card className="glass">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Chain Awards</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ChainAwardPicker
            players={players}
            sourceType="practice"
            sourceId={practiceId}
            date={practice.date}
          />
        </CardContent>
      </Card>

      {/* Player Notes */}
      {notesByPlayer.size > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gradient">Player Notes</h2>
          {[...notesByPlayer.entries()].map(([pid, playerNotes]) => {
            const player = players.find((p) => p.id === pid);
            return (
              <Card key={pid} className="glass">
                <CardContent className="p-4">
                  <div className="font-semibold text-sm mb-2">
                    #{player?.number} {player ? fullName(player) : ""}
                  </div>
                  <div className="space-y-2">
                    {playerNotes.map((n) => (
                      <div key={n.id} className="flex items-start gap-2 group">
                        <div className="flex-1">
                          {n.focus_area && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/30 mr-1.5">
                              {n.focus_area}
                            </span>
                          )}
                          <span className="text-sm prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: n.note }} />
                        </div>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-xs shrink-0"
                        >
                          <Xmark width="14" height="14" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* End Practice */}
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-bold border-primary/30 text-primary hover:bg-primary/10 gap-2"
        onClick={() => setShowEndSummary(true)}
      >
        <DoubleCheck width="18" height="18" />
        End Practice
      </Button>

      {/* Summary Modal */}
      {showEndSummary && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowEndSummary(false)}>
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 mb-3">
                <DoubleCheck width="24" height="24" className="text-primary" />
              </div>
              <h2 className="text-xl font-extrabold text-gradient">Practice Complete</h2>
              <p className="text-sm text-muted-foreground mt-1">{practice.title} &middot; {new Date(practice.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center">
                <div className="text-2xl font-extrabold text-primary">{presentCount}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Present</div>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center">
                <div className="text-2xl font-extrabold">{absentCount}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Absent</div>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center">
                <div className="text-2xl font-extrabold">{completedCount}<span className="text-base font-normal text-muted-foreground">/{planItems.length}</span></div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Drills Done</div>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center">
                <div className="text-2xl font-extrabold">{totalPlanMinutes}<span className="text-base font-normal text-muted-foreground">m</span></div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Time</div>
              </div>
            </div>

            {notes.length > 0 && (
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Player Notes</div>
                <div className="text-sm">{notes.length} note{notes.length !== 1 ? "s" : ""} across {notesByPlayer.size} player{notesByPlayer.size !== 1 ? "s" : ""}</div>
              </div>
            )}

            {actionItems.length > 0 && (
              <div className="rounded-xl bg-muted/30 border border-border/50 p-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Action Items</div>
                <div className="text-sm">{actionCompletedCount}/{actionItems.length} completed</div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 h-11 text-sm" onClick={() => setShowEndSummary(false)}>
                Keep Going
              </Button>
              <Button
                className="flex-1 h-11 text-sm font-bold"
                onClick={endPractice}
                disabled={ending}
              >
                {ending ? "Saving..." : "Finish Practice"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
