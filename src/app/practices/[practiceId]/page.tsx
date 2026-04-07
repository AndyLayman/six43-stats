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
  PracticeSquadGroup, PracticeSquadMember,
} from "@/lib/scoring/types";
import { VenuePicker } from "@/components/venue-picker";
import { firstName } from "@/lib/player-name";

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

  // Venue editing
  const [editingVenue, setEditingVenue] = useState(false);
  const [venue, setVenue] = useState("");
  const [venueAddress, setVenueAddress] = useState("");

  // Squad split planning
  const [players, setPlayers] = useState<Player[]>([]);
  const [squadGroups, setSquadGroups] = useState<PracticeSquadGroup[]>([]);
  const [squadMembers, setSquadMembers] = useState<PracticeSquadMember[]>([]);
  const [showSquadSetup, setShowSquadSetup] = useState(false);

  useEffect(() => {
    async function load() {
      const [practiceRes, planRes, templatesRes, templateItemsRes, drillsRes, playersRes, squadGroupsRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_plan_templates").select("*").order("name"),
        supabase.from("practice_plan_template_items").select("*").order("sort_order"),
        supabase.from("drills").select("*").order("name"),
        supabase.from("players").select("*").order("sort_order"),
        supabase.from("practice_squad_groups").select("*").eq("practice_id", practiceId).order("sort_order"),
      ]);

      setPractice(practiceRes.data);
      setPlanItems(planRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
      setTemplateItems(templateItemsRes.data ?? []);
      setDrills(drillsRes.data ?? []);
      setPlayers(playersRes.data ?? []);

      const groups = (squadGroupsRes.data ?? []) as PracticeSquadGroup[];
      setSquadGroups(groups);
      if (groups.length > 0) {
        setShowSquadSetup(true);
        const groupIds = groups.map((g) => g.id);
        const { data: members } = await supabase.from("practice_squad_members").select("*").in("group_id", groupIds);
        setSquadMembers(members ?? []);
      }
      setVenue(practiceRes.data?.venue ?? "");
      setVenueAddress(practiceRes.data?.venue_address ?? "");
      setLoading(false);
    }
    load();
  }, [practiceId]);

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

  // ---- Squad Split ----
  const GROUP_COLORS = [
    { name: "Blue", bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
    { name: "Gold", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
    { name: "Green", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
    { name: "Purple", bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" },
  ];

  async function createSquadGroups(count: number) {
    // Delete existing groups for this practice (cascade deletes members)
    await supabase.from("practice_squad_groups").delete().eq("practice_id", practiceId);
    const rows = Array.from({ length: count }, (_, i) => ({
      practice_id: practiceId,
      name: GROUP_COLORS[i].name,
      color_index: i,
      sort_order: i,
    }));
    const { data } = await supabase.from("practice_squad_groups").insert(rows).select();
    setSquadGroups(data ?? []);
    setSquadMembers([]);
    setShowSquadSetup(true);
  }

  async function deleteAllSquadGroups() {
    await supabase.from("practice_squad_groups").delete().eq("practice_id", practiceId);
    setSquadGroups([]);
    setSquadMembers([]);
    setShowSquadSetup(false);
  }

  async function randomizeSquads() {
    if (squadGroups.length === 0) return;
    // Remove all existing members
    const groupIds = squadGroups.map((g) => g.id);
    for (const gid of groupIds) {
      await supabase.from("practice_squad_members").delete().eq("group_id", gid);
    }
    // Shuffle all players into groups
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const newMembers: { group_id: string; player_id: number }[] = [];
    shuffled.forEach((p, i) => {
      newMembers.push({ group_id: squadGroups[i % squadGroups.length].id, player_id: p.id });
    });
    const { data } = await supabase.from("practice_squad_members").insert(newMembers).select();
    setSquadMembers(data ?? []);
  }

  async function assignPlayerToGroup(playerId: number, groupId: string) {
    // Remove from any current group
    const existing = squadMembers.filter((m) => m.player_id === playerId);
    for (const m of existing) {
      await supabase.from("practice_squad_members").delete().eq("id", m.id);
    }
    // Add to new group
    const { data } = await supabase.from("practice_squad_members").insert({ group_id: groupId, player_id: playerId }).select().single();
    const filtered = squadMembers.filter((m) => m.player_id !== playerId);
    if (data) setSquadMembers([...filtered, data]);
  }

  async function removePlayerFromSquad(playerId: number) {
    const existing = squadMembers.filter((m) => m.player_id === playerId);
    for (const m of existing) {
      await supabase.from("practice_squad_members").delete().eq("id", m.id);
    }
    setSquadMembers(squadMembers.filter((m) => m.player_id !== playerId));
  }

  function getGroupMembers(groupId: string): Player[] {
    const memberIds = squadMembers.filter((m) => m.group_id === groupId).map((m) => m.player_id);
    return players.filter((p) => memberIds.includes(p.id));
  }

  function getUnassignedPlayers(): Player[] {
    const assignedIds = new Set(squadMembers.map((m) => m.player_id));
    return players.filter((p) => !assignedIds.has(p.id));
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
              {planItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border-2 border-border/50 bg-muted/20 p-3 group"
                >
                  <span className="text-xs text-muted-foreground font-bold w-5 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    {item.drill_id && (
                      <div className="text-[10px] text-primary/60">From drill library</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.duration_minutes}m</span>
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
              ))}
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

      {/* Squad Split Planning */}
      <Card className="glass overflow-visible">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium flex items-center justify-between">
            <span>Split Squad</span>
            {squadGroups.length > 0 && (
              <button onClick={deleteAllSquadGroups} className="text-xs normal-case font-normal text-muted-foreground hover:text-destructive transition-colors">
                Clear
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {squadGroups.length === 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Create groups to split the squad for drills or scrimmages.</p>
              <div className="flex gap-2">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => createSquadGroups(n)}
                    className="flex-1 h-9 rounded-xl text-xs font-bold border-2 bg-muted/30 text-foreground border-border/50 hover:border-primary/30 transition-all active:scale-95 select-none"
                  >
                    {n} Groups
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Group count switcher + actions */}
              <div className="flex gap-2">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => createSquadGroups(n)}
                    className={`flex-1 h-9 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 select-none ${
                      squadGroups.length === n
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-muted/30 text-foreground border-border/50 hover:border-primary/30"
                    }`}
                  >
                    {n} Groups
                  </button>
                ))}
                <button
                  onClick={randomizeSquads}
                  className="h-9 px-3 rounded-xl text-xs font-bold border-2 bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/30 transition-all active:scale-95 select-none flex items-center gap-1.5 shrink-0"
                  title="Randomize"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                  Randomize
                </button>
              </div>

              {/* Groups */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(squadGroups.length, 2)}, 1fr)` }}>
                {squadGroups.map((group) => {
                  const color = GROUP_COLORS[group.color_index] ?? GROUP_COLORS[0];
                  const members = getGroupMembers(group.id);
                  return (
                    <div key={group.id} className={`rounded-xl border-2 ${color.border} ${color.bg} p-3`}>
                      <div className={`text-xs font-bold ${color.text} mb-2`}>
                        {group.name} ({members.length})
                      </div>
                      <div className="space-y-1 mb-2">
                        {members.map((p) => (
                          <div key={p.id} className="flex items-center justify-between group/member">
                            <span className="text-xs font-medium">#{p.number} {firstName(p)}</span>
                            <button
                              onClick={() => removePlayerFromSquad(p.id)}
                              className="opacity-0 group-hover/member:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Drop zone: unassigned players can be added here */}
                      {getUnassignedPlayers().length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {getUnassignedPlayers().map((p) => (
                            <button
                              key={p.id}
                              onClick={() => assignPlayerToGroup(p.id, group.id)}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-muted/40 text-muted-foreground border border-border/30 hover:border-primary/40 hover:text-primary transition-all active:scale-95"
                            >
                              +#{p.number}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unassigned players */}
              {getUnassignedPlayers().length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1.5">
                    Unassigned ({getUnassignedPlayers().length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {getUnassignedPlayers().map((p) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-muted/30 text-muted-foreground border border-border/50"
                      >
                        #{p.number} {firstName(p)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Tap a +# button inside a group to assign, or use Randomize.</p>
                </div>
              )}
            </div>
          )}
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
