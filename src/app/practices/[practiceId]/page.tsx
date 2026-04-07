"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Practice, Player, Drill,
  PracticePlanItem, PracticePlanTemplate, PracticePlanTemplateItem,
  SquadGroup, SquadMember,
} from "@/lib/scoring/types";
import { firstName } from "@/lib/player-name";
import { VenuePicker } from "@/components/venue-picker";

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
  const [players, setPlayers] = useState<Player[]>([]);
  const [squadGroups, setSquadGroups] = useState<SquadGroup[]>([]);
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  // Venue editing
  const [editingVenue, setEditingVenue] = useState(false);
  const [venue, setVenue] = useState("");
  const [venueAddress, setVenueAddress] = useState("");

  useEffect(() => {
    async function load() {
      const [practiceRes, planRes, templatesRes, templateItemsRes, drillsRes, playersRes, groupsRes, membersRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_plan_templates").select("*").order("name"),
        supabase.from("practice_plan_template_items").select("*").order("sort_order"),
        supabase.from("drills").select("*").order("name"),
        supabase.from("players").select("*").order("sort_order"),
        supabase.from("practice_squad_groups").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_squad_members").select("*"),
      ]);

      setPractice(practiceRes.data);
      setPlanItems(planRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
      setTemplateItems(templateItemsRes.data ?? []);
      setDrills(drillsRes.data ?? []);
      setPlayers(playersRes.data ?? []);
      const groups = (groupsRes.data ?? []) as SquadGroup[];
      setSquadGroups(groups);
      const groupIds = new Set(groups.map((g) => g.id));
      setSquadMembers(((membersRes.data ?? []) as SquadMember[]).filter((m) => groupIds.has(m.group_id)));
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
    await supabase.from("practice_squad_members").delete().eq("group_id", groupId);
    await supabase.from("practice_squad_groups").delete().eq("id", groupId);
    setSquadMembers(squadMembers.filter((m) => m.group_id !== groupId));
    setSquadGroups(squadGroups.filter((g) => g.id !== groupId));
  }

  async function renameSquadGroup(groupId: string, name: string) {
    await supabase.from("practice_squad_groups").update({ name }).eq("id", groupId);
    setSquadGroups(squadGroups.map((g) => (g.id === groupId ? { ...g, name } : g)));
    setEditingGroupId(null);
  }

  async function assignToGroup(playerId: number, groupId: string) {
    const existing = squadMembers.find((m) => m.player_id === playerId);
    if (existing) {
      if (existing.group_id === groupId) {
        await supabase.from("practice_squad_members").delete().eq("id", existing.id);
        setSquadMembers(squadMembers.filter((m) => m.id !== existing.id));
        return;
      }
      await supabase.from("practice_squad_members").delete().eq("id", existing.id);
    }
    const { data } = await supabase
      .from("practice_squad_members")
      .insert({ group_id: groupId, player_id: playerId })
      .select()
      .single();
    if (data) setSquadMembers([...squadMembers.filter((m) => m.player_id !== playerId), data]);
  }

  async function randomizeGroups() {
    if (squadGroups.length < 2) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const groupIds = squadGroups.map((g) => g.id);
    for (const gid of groupIds) {
      await supabase.from("practice_squad_members").delete().eq("group_id", gid);
    }
    const newMembers: SquadMember[] = [];
    for (let i = 0; i < shuffled.length; i++) {
      const groupId = groupIds[i % groupIds.length];
      const { data } = await supabase
        .from("practice_squad_members")
        .insert({ group_id: groupId, player_id: shuffled[i].id })
        .select()
        .single();
      if (data) newMembers.push(data);
    }
    setSquadMembers(newMembers);
  }

  async function addSquadSplitBlock() {
    // Add a squad split block to the practice plan
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
    // Ensure at least 2 groups exist
    if (squadGroups.length === 0) {
      const g1 = await supabase.from("practice_squad_groups").insert({ practice_id: practiceId, name: "Group 1", color_index: 0, sort_order: 0 }).select().single();
      const g2 = await supabase.from("practice_squad_groups").insert({ practice_id: practiceId, name: "Group 2", color_index: 1, sort_order: 1 }).select().single();
      if (g1.data && g2.data) setSquadGroups([g1.data, g2.data]);
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

  const totalPlanMinutes = planItems.reduce((s, i) => s + i.duration_minutes, 0);

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
            <div className="space-y-2">
              {planItems.map((item, idx) => {
                const isSquadSplit = item.label === "Squad Split" && !item.drill_id;

                return (
                  <div key={item.id} className="rounded-xl border-2 border-border/50 bg-muted/20 overflow-hidden">
                    <div className="flex items-center gap-3 p-3 group">
                      <span className="text-xs text-muted-foreground font-bold w-5 shrink-0">{idx + 1}</span>
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
                          <div className="text-[10px] text-primary/60">{squadGroups.length} group{squadGroups.length !== 1 ? "s" : ""} · {squadMembers.length} assigned</div>
                        )}
                      </div>
                      {!isSquadSplit && <span className="text-xs text-muted-foreground shrink-0">{item.duration_minutes}m</span>}
                      <div className="flex gap-0.5 shrink-0">
                        <button
                          onClick={() => movePlanItem(idx, "up")}
                          disabled={idx === 0}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                        </button>
                        <button
                          onClick={() => movePlanItem(idx, "down")}
                          disabled={idx === planItems.length - 1}
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
                          {squadGroups.length >= 2 && (
                            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={randomizeGroups}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg>
                              Randomize
                            </Button>
                          )}
                        </div>

                        {/* Groups side by side */}
                        <div className="grid grid-cols-2 gap-2">
                          {squadGroups.map((group) => {
                            const color = GROUP_COLORS[group.color_index % GROUP_COLORS.length];
                            const groupPlayers = squadMembers
                              .filter((m) => m.group_id === group.id)
                              .map((m) => players.find((p) => p.id === m.player_id))
                              .filter(Boolean) as Player[];

                            return (
                              <div key={group.id} className={`rounded-xl border-2 ${color.border} ${color.bg} p-2.5 flex flex-col`}>
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
                                      {group.name} ({groupPlayers.length})
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteSquadGroup(group.id)}
                                    className="text-muted-foreground hover:text-destructive transition-all"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </button>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                  {groupPlayers.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => assignToGroup(p.id, group.id)}
                                      className={`h-7 px-2 rounded-lg text-xs font-bold ${color.border} ${color.bg} ${color.text} border transition-all active:scale-95 select-none text-left truncate`}
                                    >
                                      #{p.number} {firstName(p)}
                                    </button>
                                  ))}
                                  {groupPlayers.length === 0 && (
                                    <span className="text-[10px] text-muted-foreground italic">Empty</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Unassigned players */}
                        {(() => {
                          const unassigned = players.filter((p) => !squadMembers.find((m) => m.player_id === p.id));
                          if (unassigned.length === 0 || squadGroups.length === 0) return null;
                          return (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1.5">Unassigned — tap to assign:</div>
                              <div className="flex flex-wrap gap-1.5">
                                {unassigned.map((p) => (
                                  <div key={p.id} className="relative group/player">
                                    <div className="h-7 px-2 rounded-lg text-xs font-bold border-2 border-border/50 bg-muted/30 flex items-center cursor-pointer">
                                      #{p.number} {firstName(p)}
                                    </div>
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover/player:flex gap-1 bg-background/95 backdrop-blur rounded-lg p-1 border border-border/50 shadow-lg z-10">
                                      {squadGroups.map((g) => {
                                        const c = GROUP_COLORS[g.color_index % GROUP_COLORS.length];
                                        return (
                                          <button
                                            key={g.id}
                                            onClick={() => assignToGroup(p.id, g.id)}
                                            className={`h-6 px-2 rounded text-[10px] font-bold ${c.bg} ${c.text} ${c.border} border transition-all active:scale-95`}
                                          >
                                            {g.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <p className="text-[10px] text-muted-foreground">Tap group name to rename. Hover unassigned players to pick a group.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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

      {/* Start Practice button */}
      <Link
        href={`/practices/${practiceId}/live`}
        className="block w-full"
      >
        <Button className="w-full h-14 text-lg font-bold glow-primary active:scale-[0.98] transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          Start Practice
        </Button>
      </Link>
    </div>
  );
}
