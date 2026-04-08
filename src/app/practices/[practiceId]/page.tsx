"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Practice, Drill,
  PracticePlanItem, PracticePlanTemplate, PracticePlanTemplateItem,
  SquadGroup,
} from "@/lib/scoring/types";
import { VenuePicker } from "@/components/venue-picker";
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

function DraggableDrillItem({ item, color, onRemove }: { item: PracticePlanItem; color?: { bg: string; text: string; border: string }; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item-${item.id}`,
    data: { itemId: item.id },
  });
  const c = color ?? { bg: "bg-muted/30", text: "text-foreground", border: "border-border/50" };
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs font-bold ${c.border} ${c.bg} ${c.text} border transition-all select-none cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-30" : ""}`}
    >
      <span className="truncate flex-1">{item.label}</span>
      {item.duration_minutes > 0 && <span className="text-[10px] opacity-60 shrink-0">{item.duration_minutes}m</span>}
      {onRemove && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 ml-0.5 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      )}
    </div>
  );
}

function DroppableMainPlan() {
  const { isOver, setNodeRef } = useDroppable({ id: "main-plan" });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-2 text-center transition-all ${isOver ? "border-primary/60 bg-primary/10 ring-2 ring-primary/30" : "border-border/30"}`}
    >
      <span className="text-[10px] text-muted-foreground">Drop here to remove from group</span>
    </div>
  );
}

function PlanItemDragHandle({ itemId }: { itemId: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `item-${itemId}`,
    data: { itemId },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground shrink-0 p-0.5"
      tabIndex={-1}
      aria-label="Drag to assign to group"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
      </svg>
    </button>
  );
}

function DroppableGroup({ groupId, children, color }: { groupId: string; children: React.ReactNode; color: { bg: string; text: string; border: string } }) {
  const { isOver, setNodeRef } = useDroppable({ id: `group-${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 ${color.border} ${color.bg} p-2.5 flex flex-col transition-all ${isOver ? "ring-2 ring-primary/50 scale-[1.02]" : ""}`}
    >
      {children}
    </div>
  );
}

export default function PracticeSetupPage() {
  const params = useParams();
  const practiceId = params.practiceId as string;

  const [practice, setPractice] = useState<Practice | null>(null);
  const [loading, setLoading] = useState(true);

  // Practice plan items
  const [planItems, setPlanItems] = useState<PracticePlanItem[]>([]);
  const [templates, setTemplates] = useState<PracticePlanTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<PracticePlanTemplateItem[]>([]);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockLabel, setNewBlockLabel] = useState("");
  const [newBlockDuration, setNewBlockDuration] = useState("10");
  const [drills, setDrills] = useState<Drill[]>([]);
  const [planFilterCategory, setPlanFilterCategory] = useState<string | null>(null);
  const [planSearchQuery, setPlanSearchQuery] = useState("");
  const [planShowAll, setPlanShowAll] = useState(false);

  // Squad groups
  const [squadGroups, setSquadGroups] = useState<SquadGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [editingDurationValue, setEditingDurationValue] = useState("");

  // Drag and drop
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Venue editing
  const [editingVenue, setEditingVenue] = useState(false);
  const [venue, setVenue] = useState("");
  const [venueAddress, setVenueAddress] = useState("");

  useEffect(() => {
    async function load() {
      const [practiceRes, planRes, templatesRes, templateItemsRes, drillsRes, groupsRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_plan_templates").select("*").order("name"),
        supabase.from("practice_plan_template_items").select("*").order("sort_order"),
        supabase.from("drills").select("*").order("name"),
        supabase.from("practice_squad_groups").select("*").eq("practice_id", practiceId).order("sort_order"),
      ]);

      setPractice(practiceRes.data);
      setPlanItems(planRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
      setTemplateItems(templateItemsRes.data ?? []);
      setDrills(drillsRes.data ?? []);
      setSquadGroups((groupsRes.data ?? []) as SquadGroup[]);
      setVenue(practiceRes.data?.venue ?? "");
      setVenueAddress(practiceRes.data?.venue_address ?? "");
      setLoading(false);
    }
    load();
  }, [practiceId]);

  // ---- Squad Groups ----
  const GROUP_COLORS = [
    { bg: "bg-teal-500/20", text: "text-teal-400", border: "border-teal-500/40" },
    { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/40" },
    { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/40" },
    { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/40" },
    { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-500/40" },
    { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/40" },
  ];

  async function addSquadGroup() {
    const nextIndex = squadGroups.length;
    const { data } = await supabase
      .from("practice_squad_groups")
      .insert({ practice_id: practiceId, name: `Group ${nextIndex + 1}`, color_index: nextIndex % GROUP_COLORS.length, sort_order: nextIndex })
      .select()
      .single();
    if (data) setSquadGroups([...squadGroups, data]);
  }

  async function deleteSquadGroup(groupId: string) {
    // Unassign any items in this group
    const itemsInGroup = planItems.filter((i) => i.group_id === groupId);
    for (const item of itemsInGroup) {
      await supabase.from("practice_plan_items").update({ group_id: null }).eq("id", item.id);
    }
    setPlanItems(planItems.map((i) => i.group_id === groupId ? { ...i, group_id: null } : i));
    await supabase.from("practice_squad_groups").delete().eq("id", groupId);
    setSquadGroups(squadGroups.filter((g) => g.id !== groupId));
  }

  async function saveDuration(itemId: string, minutes: number) {
    const clamped = Math.max(0, minutes);
    await supabase.from("practice_plan_items").update({ duration_minutes: clamped }).eq("id", itemId);
    setPlanItems(planItems.map((i) => i.id === itemId ? { ...i, duration_minutes: clamped } : i));
    setEditingDurationId(null);
  }

  async function renameSquadGroup(groupId: string, name: string) {
    await supabase.from("practice_squad_groups").update({ name }).eq("id", groupId);
    setSquadGroups(squadGroups.map((g) => (g.id === groupId ? { ...g, name } : g)));
    setEditingGroupId(null);
  }

  async function assignItemToGroup(itemId: string, groupId: string | null) {
    await supabase.from("practice_plan_items").update({ group_id: groupId }).eq("id", itemId);
    setPlanItems(planItems.map((i) => i.id === itemId ? { ...i, group_id: groupId } : i));
  }

  async function addDrillToGroup(drill: Drill, groupId: string) {
    const { data } = await supabase
      .from("practice_plan_items")
      .insert({
        practice_id: practiceId,
        drill_id: drill.id,
        label: drill.name,
        duration_minutes: drill.duration_minutes ?? 10,
        sort_order: planItems.length,
        completed: false,
        group_id: groupId,
      })
      .select()
      .single();
    if (data) setPlanItems([...planItems, data]);
  }

  async function addCustomBlockToGroup(label: string, duration: number, groupId: string) {
    const { data } = await supabase
      .from("practice_plan_items")
      .insert({
        practice_id: practiceId,
        label,
        duration_minutes: duration,
        sort_order: planItems.length,
        completed: false,
        group_id: groupId,
      })
      .select()
      .single();
    if (data) setPlanItems([...planItems, data]);
  }

  async function addSquadSplitBlock() {
    const { data } = await supabase
      .from("practice_plan_items")
      .insert({
        practice_id: practiceId,
        label: "Squad Split",
        duration_minutes: 0,
        sort_order: planItems.length,
        completed: false,
      })
      .select()
      .single();
    if (data) setPlanItems([...planItems, data]);
    if (squadGroups.length === 0) {
      const g1 = await supabase.from("practice_squad_groups").insert({ practice_id: practiceId, name: "Group 1", color_index: 0, sort_order: 0 }).select().single();
      const g2 = await supabase.from("practice_squad_groups").insert({ practice_id: practiceId, name: "Group 2", color_index: 1, sort_order: 1 }).select().single();
      if (g1.data && g2.data) setSquadGroups([g1.data, g2.data]);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const itemId = event.active.data.current?.itemId as string;
    setActiveDragId(itemId);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const itemId = active.data.current?.itemId as string;
    const overId = over.id as string;

    if (overId === "main-plan") {
      await assignItemToGroup(itemId, null);
    } else if (overId.startsWith("group-")) {
      const groupId = overId.replace("group-", "");
      await assignItemToGroup(itemId, groupId);
    }
  }

  // ---- Venue ----
  async function saveVenue() {
    await supabase.from("practices").update({ venue: venue || null, venue_address: venueAddress || null }).eq("id", practiceId);
    setPractice(practice ? { ...practice, venue, venue_address: venueAddress } : null);
    setEditingVenue(false);
  }

  // ---- Practice Plan ----
  async function applyTemplate(templateId: string) {
    const items = templateItems.filter((i) => i.template_id === templateId);
    if (items.length === 0) return;
    await supabase.from("practice_plan_items").delete().eq("practice_id", practiceId);
    const rows = items.map((i, idx) => ({
      practice_id: practiceId,
      drill_id: i.drill_id,
      label: i.label,
      duration_minutes: i.duration_minutes,
      sort_order: idx,
      completed: false,
    }));
    const { data } = await supabase.from("practice_plan_items").insert(rows).select();
    setPlanItems(data ?? []);
  }

  async function deletePlanItem(id: string) {
    await supabase.from("practice_plan_items").delete().eq("id", id);
    setPlanItems(planItems.filter((i) => i.id !== id));
  }

  async function addPlanBlock() {
    if (!newBlockLabel.trim()) return;
    const { data } = await supabase
      .from("practice_plan_items")
      .insert({
        practice_id: practiceId,
        label: newBlockLabel.trim(),
        duration_minutes: parseInt(newBlockDuration) || 10,
        sort_order: planItems.length,
        completed: false,
      })
      .select()
      .single();
    if (data) {
      setPlanItems([...planItems, data]);
      setNewBlockLabel("");
      setNewBlockDuration("10");
      setShowAddBlock(false);
    }
  }

  async function addDrillToPlan(drill: Drill) {
    const { data } = await supabase
      .from("practice_plan_items")
      .insert({
        practice_id: practiceId,
        drill_id: drill.id,
        label: drill.name,
        duration_minutes: drill.duration_minutes ?? 10,
        sort_order: planItems.length,
        completed: false,
      })
      .select()
      .single();
    if (data) setPlanItems([...planItems, data]);
  }

  async function movePlanItem(idx: number, direction: "up" | "down") {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= planItems.length) return;
    const copy = [...planItems];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setPlanItems(copy);
    await Promise.all([
      supabase.from("practice_plan_items").update({ sort_order: newIdx }).eq("id", copy[newIdx].id),
      supabase.from("practice_plan_items").update({ sort_order: idx }).eq("id", copy[idx].id),
    ]);
  }

  if (loading || !practice) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Only count top-level items (not items assigned to groups) for the plan total
  const topLevelItems = planItems.filter((i) => !i.group_id);
  const totalPlanMinutes = topLevelItems.reduce((s, i) => s + i.duration_minutes, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <Link href="/practices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Practices
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">{practice.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(practice.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        {(practice.venue || practice.venue_address) && !editingVenue && (
          <div className="flex items-center gap-2 mt-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="text-sm">{practice.venue}</span>
            {practice.venue_address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.venue_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Directions
              </a>
            )}
            <button onClick={() => setEditingVenue(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors">Edit</button>
          </div>
        )}
      </div>

      {/* Venue editor */}
      {(editingVenue || (!practice.venue && !practice.venue_address)) && (
        <Card className="glass">
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <VenuePicker
              venue={venue}
              venueAddress={venueAddress}
              onVenueChange={setVenue}
              onAddressChange={setVenueAddress}
            />
            <Button
              variant="outline"
              className="mt-2 h-9 text-xs font-semibold border-border/50"
              onClick={saveVenue}
            >
              Save Location
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Practice Plan */}
      <Card className="glass overflow-visible">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium flex items-center justify-between">
            <span>Practice Plan</span>
            {planItems.length > 0 && (
              <span className="text-xs normal-case font-normal">
                {planItems.length} block{planItems.length !== 1 ? "s" : ""} &middot; {totalPlanMinutes} min
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3 overflow-visible">
          {/* Load from template */}
          {planItems.length === 0 && templates.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground self-center">Load template:</span>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border-2 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 transition-all active:scale-95"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* Plan items — numbered blocks with reorder */}
          {planItems.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="space-y-2">
                {planItems.filter((item) => !item.group_id).map((item) => {
                  const fullIdx = planItems.findIndex((i) => i.id === item.id);
                  const isSquadSplit = item.label === "Squad Split" && !item.drill_id;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border-2 border-border/50 bg-muted/20 overflow-hidden transition-opacity ${activeDragId === item.id ? "opacity-30" : ""}`}
                    >
                      <div className="flex items-center gap-3 p-3 group">
                        {!isSquadSplit && <PlanItemDragHandle itemId={item.id} />}
                        <span className="text-xs text-muted-foreground font-bold w-5 shrink-0">{fullIdx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {isSquadSplit && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            )}
                            {item.label}
                          </div>
                          {item.drill_id && (
                            <div className="text-[10px] text-primary/60">From drill library</div>
                          )}
                          {isSquadSplit && (
                            <div className="text-[10px] text-primary/60">{squadGroups.length} group{squadGroups.length !== 1 ? "s" : ""} · {planItems.filter((i) => i.group_id).length} drill{planItems.filter((i) => i.group_id).length !== 1 ? "s" : ""}</div>
                          )}
                        </div>
                        {!isSquadSplit && (
                          editingDurationId === item.id ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                value={editingDurationValue}
                                onChange={(e) => setEditingDurationValue(e.target.value)}
                                onBlur={() => saveDuration(item.id, parseInt(editingDurationValue) || 0)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveDuration(item.id, parseInt(editingDurationValue) || 0);
                                  if (e.key === "Escape") setEditingDurationId(null);
                                }}
                                className="w-12 h-6 text-xs text-center bg-input/50 border border-border/50 rounded px-1"
                                autoFocus
                                min={0}
                              />
                              <span className="text-xs text-muted-foreground">m</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingDurationId(item.id); setEditingDurationValue(String(item.duration_minutes)); }}
                              className="text-xs text-muted-foreground shrink-0 hover:text-primary transition-colors tabular-nums"
                              title="Click to edit duration"
                            >
                              {item.duration_minutes}m
                            </button>
                          )
                        )}
                        <div className="flex gap-0.5 shrink-0">
                          <button
                            onClick={() => movePlanItem(fullIdx, "up")}
                            disabled={fullIdx === 0}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                          </button>
                          <button
                            onClick={() => movePlanItem(fullIdx, "down")}
                            disabled={fullIdx === planItems.length - 1}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                          <button
                            onClick={() => deletePlanItem(item.id)}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Squad Split inline editor */}
                      {isSquadSplit && (
                        <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={addSquadGroup}>+ Group</Button>
                          </div>

                          {/* Groups side by side */}
                          <div className="grid grid-cols-2 gap-2">
                            {squadGroups.map((group) => {
                              const color = GROUP_COLORS[group.color_index % GROUP_COLORS.length];
                              const groupItems = planItems.filter((i) => i.group_id === group.id);

                              return (
                                <DroppableGroup key={group.id} groupId={group.id} color={color}>
                                  <div className="flex items-center justify-between mb-2">
                                    {editingGroupId === group.id ? (
                                      <Input
                                        value={editingGroupName}
                                        onChange={(e) => setEditingGroupName(e.target.value)}
                                        onBlur={() => renameSquadGroup(group.id, editingGroupName)}
                                        onKeyDown={(e) => e.key === "Enter" && renameSquadGroup(group.id, editingGroupName)}
                                        className="h-6 text-xs w-24 bg-transparent border-border/50"
                                        autoFocus
                                      />
                                    ) : (
                                      <button
                                        onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}
                                        className={`text-xs font-bold ${color.text}`}
                                      >
                                        {group.name}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deleteSquadGroup(group.id)}
                                      className="text-muted-foreground hover:text-destructive transition-all"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                    </button>
                                  </div>
                                  <div className="flex flex-col gap-1 flex-1 min-h-[2.5rem]">
                                    {groupItems.map((gi) => (
                                      <DraggableDrillItem key={gi.id} item={gi} color={color} onRemove={() => assignItemToGroup(gi.id, null)} />
                                    ))}
                                    {groupItems.length === 0 && (
                                      <span className="text-[10px] text-muted-foreground italic">Drag items here</span>
                                    )}
                                  </div>
                                  {/* Quick add drill to this group */}
                                  <div className="mt-2 border-t border-white/10 pt-2">
                                    <select
                                      className="w-full h-7 text-[10px] rounded-lg bg-transparent border border-border/50 px-1 text-muted-foreground cursor-pointer"
                                      value=""
                                      onChange={(e) => {
                                        const drill = drills.find((d) => d.id === e.target.value);
                                        if (drill) addDrillToGroup(drill, group.id);
                                      }}
                                    >
                                      <option value="">+ Add drill...</option>
                                      {drills.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}{d.duration_minutes ? ` (${d.duration_minutes}m)` : ""}</option>
                                      ))}
                                    </select>
                                  </div>
                                </DroppableGroup>
                              );
                            })}
                          </div>

                          <DroppableMainPlan />
                          <p className="text-[10px] text-muted-foreground">Drag between groups or drop above to remove from group. Use the dropdown to add drills directly. Tap group name to rename.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <DragOverlay>
                {activeDragId ? (() => {
                  const draggedItem = planItems.find((i) => i.id === activeDragId);
                  if (!draggedItem) return null;
                  return (
                    <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs font-bold border-2 border-primary/60 bg-primary/20 text-primary shadow-lg cursor-grabbing max-w-xs min-w-0">
                      <span className="truncate">{draggedItem.label}</span>
                      {draggedItem.duration_minutes > 0 && <span className="text-[10px] opacity-60">{draggedItem.duration_minutes}m</span>}
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* Dotted placeholder — add next block */}
          <div className="rounded-xl border-2 border-dashed border-border/40 p-6">
            <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium mb-4 text-center">
              Add block #{planItems.length + 1}
            </div>

            {/* Search + Category filter */}
            {drills.length > 0 && (() => {
              const searched = planSearchQuery.trim()
                ? drills.filter((d) => d.name.toLowerCase().includes(planSearchQuery.toLowerCase()))
                : drills;
              const filtered = planFilterCategory
                ? searched.filter((d) => d.category === planFilterCategory)
                : searched;
              const isSearching = planSearchQuery.trim().length > 0 || planFilterCategory !== null;
              const showAll = planShowAll || isSearching;
              const visible = showAll ? filtered : filtered.slice(0, 4);
              const faded = showAll ? [] : filtered.slice(4, 6);
              const hiddenCount = showAll ? 0 : Math.max(0, filtered.length - 6);

              return (
                <>
                  <div className="mb-3">
                    <Input
                      value={planSearchQuery}
                      onChange={(e) => { setPlanSearchQuery(e.target.value); setPlanShowAll(false); }}
                      placeholder="Search drills..."
                      className="h-9 text-sm bg-input/50 border-border/50"
                    />
                  </div>

                  <div className="flex gap-1.5 flex-wrap justify-center mb-3">
                    <button
                      onClick={() => { setPlanFilterCategory(null); setPlanShowAll(false); }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 select-none ${
                        !planFilterCategory
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-muted/30 text-muted-foreground border-border/50"
                      }`}
                    >
                      All
                    </button>
                    {[...new Set(drills.map((d) => d.category))].sort().map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setPlanFilterCategory(planFilterCategory === cat ? null : cat); setPlanShowAll(false); }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 select-none ${
                          planFilterCategory === cat
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "bg-muted/30 text-muted-foreground border-border/50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {visible.map((drill) => (
                      <button
                        key={drill.id}
                        onClick={() => addDrillToPlan(drill)}
                        className="flex items-center gap-3 rounded-xl border-2 border-border/40 bg-muted/20 px-4 py-3.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98] group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{drill.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {drill.duration_minutes ? `${drill.duration_minutes} min` : ""}{drill.duration_minutes && drill.category ? " · " : ""}{drill.category}
                          </div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 group-hover:text-primary shrink-0 transition-colors"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                      </button>
                    ))}
                    {faded.map((drill) => (
                      <button
                        key={drill.id}
                        onClick={() => setPlanShowAll(true)}
                        className="flex items-center gap-3 rounded-xl border-2 border-border/40 bg-muted/20 px-4 py-3.5 text-left opacity-30 pointer-events-auto"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{drill.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {drill.duration_minutes ? `${drill.duration_minutes} min` : ""}{drill.duration_minutes && drill.category ? " · " : ""}{drill.category}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {!showAll && hiddenCount > 0 && (
                    <button
                      onClick={() => setPlanShowAll(true)}
                      className="w-full text-center text-xs text-primary font-bold py-2 hover:underline transition-all mb-2"
                    >
                      Show all {filtered.length} drills
                    </button>
                  )}
                  {showAll && !isSearching && filtered.length > 6 && (
                    <button
                      onClick={() => setPlanShowAll(false)}
                      className="w-full text-center text-xs text-muted-foreground font-bold py-2 hover:underline transition-all mb-2"
                    >
                      Show less
                    </button>
                  )}

                  {filtered.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2 mb-2">No drills match your search.</p>
                  )}
                </>
              );
            })()}

            {/* Squad Split block */}
            {!planItems.some((i) => i.label === "Squad Split" && !i.drill_id) && (
              <button
                onClick={addSquadSplitBlock}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-3.5 text-left hover:border-primary/50 hover:bg-primary/10 transition-all active:scale-[0.98] group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary">Squad Split</div>
                  <div className="text-xs text-muted-foreground">Split team into groups for station rotations</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40 group-hover:text-primary shrink-0 transition-colors"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </button>
            )}

            {/* Custom block input */}
            {showAddBlock ? (
              <div className="flex gap-2 items-center">
                <Input
                  value={newBlockLabel}
                  onChange={(e) => setNewBlockLabel(e.target.value)}
                  placeholder="Block name"
                  className="flex-1 h-9 text-sm bg-input/50 border-border/50"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addPlanBlock()}
                />
                <Input
                  type="number"
                  value={newBlockDuration}
                  onChange={(e) => setNewBlockDuration(e.target.value)}
                  className="w-14 h-9 text-sm bg-input/50 border-border/50 text-center"
                />
                <span className="text-xs text-muted-foreground">min</span>
                <Button variant="outline" className="h-9 text-xs shrink-0" onClick={addPlanBlock}>Add</Button>
                <Button variant="outline" className="h-9 text-xs shrink-0" onClick={() => setShowAddBlock(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddBlock(true)}
                className="w-full rounded-lg border border-dashed border-border/40 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all active:scale-[0.98]"
              >
                + Custom block (not from library)
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sticky bottom bar — portal to escape ancestor transform from animate-fade-in */}
      {createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/90 backdrop-blur-md border-t border-border/50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto">
            {practice.completed ? (
              <div className="flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-green-500/30 bg-green-500/10 text-green-400 font-bold text-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                Practice Complete
              </div>
            ) : (
              <Link href={`/practices/${practiceId}/live`} className="block w-full">
                <Button className="w-full h-14 text-lg font-bold glow-primary active:scale-[0.98] transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                  Start Practice
                </Button>
              </Link>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
