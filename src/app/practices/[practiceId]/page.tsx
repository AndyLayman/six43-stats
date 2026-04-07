"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/rich-editor";
import type {
  Practice, PracticeNote, Player, Drill,
  PracticePlanItem, PracticePlanTemplate, PracticePlanTemplateItem,
  ActionItem, PracticeAttendance, Venue,
} from "@/lib/scoring/types";
import { fullName, firstName } from "@/lib/player-name";
import { CustomSelect } from "@/components/custom-select";
import { ChainAwardPicker } from "@/components/chain-award-picker";

const FOCUS_AREAS = ["Hitting", "Fielding", "Throwing", "Baserunning", "Attitude", "Other"];

export default function PracticeDetailPage() {
  const params = useParams();
  const practiceId = params.practiceId as string;

  const [practice, setPractice] = useState<Practice | null>(null);
  const [notes, setNotes] = useState<PracticeNote[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [focusArea, setFocusArea] = useState<string | null>(null);
  const [teamNotes, setTeamNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Attendance
  const [attendance, setAttendance] = useState<Map<number, boolean>>(new Map());
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);

  // Practice plan items
  const [planItems, setPlanItems] = useState<PracticePlanItem[]>([]);
  const [templates, setTemplates] = useState<PracticePlanTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<PracticePlanTemplateItem[]>([]);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockLabel, setNewBlockLabel] = useState("");
  const [newBlockDuration, setNewBlockDuration] = useState("10");
  const [drills, setDrills] = useState<Drill[]>([]);

  // Action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [openActionItems, setOpenActionItems] = useState<ActionItem[]>([]); // from previous practices
  const [newActionText, setNewActionText] = useState("");
  const [newActionPlayer, setNewActionPlayer] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const [practiceRes, notesRes, playersRes, attendanceRes, planRes, templatesRes, templateItemsRes, drillsRes, actionRes, openActionRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_notes").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("players").select("*").order("sort_order"),
        supabase.from("practice_attendance").select("*").eq("practice_id", practiceId),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_plan_templates").select("*").order("name"),
        supabase.from("practice_plan_template_items").select("*").order("sort_order"),
        supabase.from("drills").select("*").order("name"),
        supabase.from("action_items").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("action_items").select("*").is("completed", false).is("practice_id", null).order("created_at"),
      ]);

      setPractice(practiceRes.data);
      setNotes(notesRes.data ?? []);
      setPlayers(playersRes.data ?? []);
      setTeamNotes(practiceRes.data?.notes ?? "");
      setPlanItems(planRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
      setTemplateItems(templateItemsRes.data ?? []);
      setDrills(drillsRes.data ?? []);
      setActionItems(actionRes.data ?? []);
      setOpenActionItems(openActionRes.data ?? []);

      // Build attendance map
      const attMap = new Map<number, boolean>();
      for (const a of (attendanceRes.data ?? []) as PracticeAttendance[]) {
        attMap.set(a.player_id, a.present);
      }
      setAttendance(attMap);
      setAttendanceLoaded(true);

      setLoading(false);
    }
    load();
  }, [practiceId]);

  function isEmptyHtml(html: string) {
    return html.replace(/<[^>]*>/g, "").trim().length === 0;
  }

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

  // ---- Notes ----
  async function handleAddNote() {
    if (!selectedPlayer || isEmptyHtml(noteText)) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("practice_notes")
      .insert({
        practice_id: practiceId,
        player_id: selectedPlayer,
        note: noteText.trim(),
        focus_area: focusArea,
      })
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

  // ---- Practice Plan ----
  async function applyTemplate(templateId: string) {
    const items = templateItems.filter((i) => i.template_id === templateId);
    if (items.length === 0) return;

    // Delete existing plan items
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

  async function togglePlanItem(id: string, completed: boolean) {
    setPlanItems(planItems.map((i) => (i.id === id ? { ...i, completed } : i)));
    await supabase.from("practice_plan_items").update({ completed }).eq("id", id);
  }

  async function deletePlanItem(id: string) {
    await supabase.from("practice_plan_items").delete().eq("id", id);
    setPlanItems(planItems.filter((i) => i.id !== id));
  }

  async function addPlanBlock() {
    if (!newBlockLabel.trim()) return;
    const sortOrder = planItems.length;
    const { data } = await supabase
      .from("practice_plan_items")
      .insert({
        practice_id: practiceId,
        label: newBlockLabel.trim(),
        duration_minutes: parseInt(newBlockDuration) || 10,
        sort_order: sortOrder,
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
    const sortOrder = planItems.length;
    const { data } = await supabase
      .from("practice_plan_items")
      .insert({
        practice_id: practiceId,
        drill_id: drill.id,
        label: drill.name,
        duration_minutes: drill.duration_minutes ?? 10,
        sort_order: sortOrder,
        completed: false,
      })
      .select()
      .single();
    if (data) setPlanItems([...planItems, data]);
  }

  // ---- Action Items ----
  async function addActionItem() {
    if (!newActionText.trim()) return;
    const { data } = await supabase
      .from("action_items")
      .insert({
        practice_id: practiceId,
        player_id: newActionPlayer,
        text: newActionText.trim(),
        completed: false,
      })
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
    // Update in the right list
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

  if (loading || !practice) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Group notes by player
  const notesByPlayer = new Map<number, PracticeNote[]>();
  for (const n of notes) {
    const arr = notesByPlayer.get(n.player_id) ?? [];
    arr.push(n);
    notesByPlayer.set(n.player_id, arr);
  }

  const presentCount = [...attendance.values()].filter(Boolean).length;
  const absentCount = [...attendance.values()].filter((v) => v === false).length;
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
        {(practice.venue || practice.venue_address) && (
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
          </div>
        )}
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
                      ? "bg-green-500/20 text-green-400 border-green-500/40"
                      : status === false
                      ? "bg-red-500/15 text-red-400/60 border-red-500/30 line-through"
                      : "bg-muted/30 text-foreground border-border/50"
                  }`}
                >
                  #{p.number} {firstName(p)}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Tap to mark present (green), tap again for absent (red), tap again to reset.</p>
        </CardContent>
      </Card>

      {/* Practice Plan */}
      <Card className="glass overflow-visible">
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium flex items-center justify-between">
            <span>Practice Plan</span>
            {planItems.length > 0 && (
              <span className="text-xs normal-case font-normal">
                {planItems.filter((i) => i.completed).length}/{planItems.length} done &middot; {totalPlanMinutes} min
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

          {/* Plan items */}
          {planItems.length > 0 && (
            <div className="space-y-1">
              {planItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => togglePlanItem(item.id, !item.completed)}
                    className={`h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                      item.completed
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "border-border/50 hover:border-primary/40"
                    }`}
                  >
                    {item.completed && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.duration_minutes}m</span>
                  <button
                    onClick={() => deletePlanItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add block */}
          {showAddBlock ? (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  value={newBlockLabel}
                  onChange={(e) => setNewBlockLabel(e.target.value)}
                  placeholder="Block name"
                  className="h-9 text-sm bg-input/50 border-border/50"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addPlanBlock()}
                />
              </div>
              <Input
                type="number"
                value={newBlockDuration}
                onChange={(e) => setNewBlockDuration(e.target.value)}
                className="w-16 h-9 text-sm bg-input/50 border-border/50 text-center"
              />
              <span className="text-xs text-muted-foreground mb-2">min</span>
              <Button variant="outline" className="h-9 text-xs" onClick={addPlanBlock}>Add</Button>
              <Button variant="outline" className="h-9 text-xs" onClick={() => setShowAddBlock(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" className="h-8 text-xs border-border/50" onClick={() => setShowAddBlock(true)}>
                + Add Block
              </Button>
              {drills.length > 0 && (
                <div className="relative group">
                  <Button variant="outline" className="h-8 text-xs border-border/50">
                    + From Drill Library
                  </Button>
                  <div className="absolute top-full left-0 mt-1 w-56 max-h-48 overflow-y-auto rounded-xl bg-card border border-border/50 shadow-lg z-20 hidden group-focus-within:block group-hover:block">
                    {drills.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => addDrillToPlan(d)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex justify-between"
                      >
                        <span className="truncate">{d.name}</span>
                        {d.duration_minutes && <span className="text-xs text-muted-foreground ml-2">{d.duration_minutes}m</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carry-Forward Action Items */}
      {openActionItems.length > 0 && (
        <Card className="glass border-amber-500/30">
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm text-amber-400 uppercase tracking-wider font-medium">
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
                        : "border-amber-500/40 hover:border-primary/40"
                    }`}
                  >
                    {item.completed && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
          {/* Player select */}
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
              {/* Focus area chips */}
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

              {/* Note input */}
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
      <Card className="glass overflow-visible">
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
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new action item */}
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
    </div>
  );
}
