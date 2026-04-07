"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PracticePlanTemplate, PracticePlanTemplateItem, Drill } from "@/lib/scoring/types";

interface TemplateWithItems extends PracticePlanTemplate {
  items: PracticePlanTemplateItem[];
}

const CATEGORIES = ["General", "Hitting", "Fielding", "Throwing", "Baserunning", "Conditioning", "Team"];

export default function PlanTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Builder state
  const [editItems, setEditItems] = useState<{ label: string; duration_minutes: number; drill_id: string | null }[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [customBlockName, setCustomBlockName] = useState("");
  const [customBlockDuration, setCustomBlockDuration] = useState("10");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [templatesRes, itemsRes, drillsRes] = await Promise.all([
      supabase.from("practice_plan_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("practice_plan_template_items").select("*").order("sort_order"),
      supabase.from("drills").select("*").order("name"),
    ]);

    const tpls = (templatesRes.data ?? []) as PracticePlanTemplate[];
    const items = (itemsRes.data ?? []) as PracticePlanTemplateItem[];
    setDrills(drillsRes.data ?? []);

    setTemplates(
      tpls.map((t) => ({
        ...t,
        items: items.filter((i) => i.template_id === t.id),
      }))
    );
    setLoading(false);
  }

  async function handleCreateTemplate() {
    if (!newName.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("practice_plan_templates")
      .insert({ name: newName.trim() })
      .select()
      .single();
    if (data) {
      setTemplates([{ ...data, items: [] }, ...templates]);
      setNewName("");
      setShowNew(false);
      setEditing(data.id);
      setEditItems([]);
    }
    setSaving(false);
  }

  function startEdit(template: TemplateWithItems) {
    setEditing(template.id);
    setEditItems(
      template.items.map((i) => ({ label: i.label, duration_minutes: i.duration_minutes, drill_id: i.drill_id }))
    );
  }

  function addDrillToTemplate(drill: Drill) {
    setEditItems([...editItems, {
      label: drill.name,
      duration_minutes: drill.duration_minutes ?? 10,
      drill_id: drill.id,
    }]);
  }

  function addCustomBlock() {
    if (!customBlockName.trim()) return;
    setEditItems([...editItems, {
      label: customBlockName.trim(),
      duration_minutes: parseInt(customBlockDuration) || 10,
      drill_id: null,
    }]);
    setCustomBlockName("");
    setCustomBlockDuration("10");
    setShowCustom(false);
  }

  function removeItem(idx: number) {
    setEditItems(editItems.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, direction: "up" | "down") {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= editItems.length) return;
    const copy = [...editItems];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setEditItems(copy);
  }

  function updateItemDuration(idx: number, duration: number) {
    setEditItems(editItems.map((item, i) => (i === idx ? { ...item, duration_minutes: duration } : item)));
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);

    await supabase.from("practice_plan_template_items").delete().eq("template_id", editing);

    const rows = editItems
      .filter((i) => i.label.trim())
      .map((i, idx) => ({
        template_id: editing,
        label: i.label.trim(),
        duration_minutes: i.duration_minutes,
        drill_id: i.drill_id,
        sort_order: idx,
      }));

    if (rows.length > 0) {
      await supabase.from("practice_plan_template_items").insert(rows);
    }

    setEditing(null);
    setEditItems([]);
    await loadAll();
    setSaving(false);
  }

  function handleCancel() {
    setEditing(null);
    setEditItems([]);
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await supabase.from("practice_plan_templates").delete().eq("id", id);
    setTemplates(templates.filter((t) => t.id !== id));
  }

  const totalMinutes = (items: { duration_minutes: number }[]) =>
    items.reduce((sum, i) => sum + i.duration_minutes, 0);

  const filteredDrills = filterCategory
    ? drills.filter((d) => d.category === filterCategory)
    : drills;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Edit / Build mode ──
  if (editing) {
    const template = templates.find((t) => t.id === editing);

    return (
      <div className="max-w-2xl mx-auto pb-32">
        <div className="space-y-4">
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gradient">{template?.name ?? "Template"}</h1>
              {editItems.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editItems.length} block{editItems.length !== 1 ? "s" : ""} &middot; {totalMinutes(editItems)} min total
                </p>
              )}
            </div>
          </div>

          {/* Built blocks */}
          <div className="space-y-2">
            {editItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-xl border-2 border-border/50 bg-muted/20 p-3 group"
              >
                <span className="text-xs text-muted-foreground font-bold w-5 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.drill_id && (
                    <div className="text-[10px] text-primary/60">From drill library</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    value={item.duration_minutes}
                    onChange={(e) => updateItemDuration(idx, parseInt(e.target.value) || 0)}
                    className="w-14 h-7 text-xs bg-input/50 border-border/50 text-center"
                  />
                  <span className="text-[10px] text-muted-foreground">m</span>
                </div>
                <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveItem(idx, "up")}
                    disabled={idx === 0}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  </button>
                  <button
                    onClick={() => moveItem(idx, "down")}
                    disabled={idx === editItems.length - 1}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Dotted placeholder — next block slot */}
            <div className="rounded-xl border-2 border-dashed border-border/40 p-6">
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium mb-4 text-center">
                Add block #{editItems.length + 1}
              </div>

              {/* Category filter chips */}
              {drills.length > 0 && (
                <>
                  <div className="flex gap-1.5 flex-wrap justify-center mb-3">
                    <button
                      onClick={() => setFilterCategory(null)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 select-none ${
                        !filterCategory
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-muted/30 text-muted-foreground border-border/50"
                      }`}
                    >
                      All
                    </button>
                    {CATEGORIES.filter((cat) => drills.some((d) => d.category === cat)).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 select-none ${
                          filterCategory === cat
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "bg-muted/30 text-muted-foreground border-border/50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Drill options */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {filteredDrills.map((drill) => (
                      <button
                        key={drill.id}
                        onClick={() => addDrillToTemplate(drill)}
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
                  </div>
                </>
              )}

              {/* Custom block input */}
              {showCustom ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={customBlockName}
                    onChange={(e) => setCustomBlockName(e.target.value)}
                    placeholder="Block name"
                    className="flex-1 h-9 text-sm bg-input/50 border-border/50"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && addCustomBlock()}
                  />
                  <Input
                    type="number"
                    value={customBlockDuration}
                    onChange={(e) => setCustomBlockDuration(e.target.value)}
                    className="w-14 h-9 text-sm bg-input/50 border-border/50 text-center"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                  <Button variant="outline" className="h-9 text-xs shrink-0" onClick={addCustomBlock}>Add</Button>
                  <Button variant="outline" className="h-9 text-xs shrink-0" onClick={() => setShowCustom(false)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustom(true)}
                  className="w-full rounded-lg border border-dashed border-border/40 py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-all active:scale-[0.98]"
                >
                  + Custom block (not from library)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 glass-strong safe-bottom">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm text-muted-foreground">
              {editItems.length > 0 ? (
                <span>{editItems.length} block{editItems.length !== 1 ? "s" : ""} &middot; {totalMinutes(editItems)} min</span>
              ) : (
                <span>No blocks added yet</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 px-4 text-sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                className="h-10 px-6 text-sm font-bold glow-primary active:scale-[0.98] transition-transform"
                onClick={handleSave}
                disabled={saving || editItems.length === 0}
              >
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List mode ──
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <Link href="/practices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Practices
      </Link>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">Plan Templates</h1>
        <Button
          className="h-11 px-5 text-base active:scale-95 transition-transform glow-primary"
          onClick={() => setShowNew(!showNew)}
        >
          {showNew ? "Cancel" : "New Template"}
        </Button>
      </div>

      {showNew && (
        <Card className="glass animate-slide-up gradient-border">
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Template Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Standard Practice, Game Day Prep..."
                className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
                onKeyDown={(e) => e.key === "Enter" && handleCreateTemplate()}
              />
            </div>
            <Button
              className="w-full h-12 text-base font-bold glow-primary active:scale-[0.98] transition-transform"
              onClick={handleCreateTemplate}
              disabled={saving || !newName.trim()}
            >
              {saving ? "Creating..." : "Create Template"}
            </Button>
          </CardContent>
        </Card>
      )}

      {templates.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No templates yet. Create one to structure your practices!
        </p>
      ) : (
        <div className="space-y-3 stagger-children">
          {templates.map((template) => (
            <Card key={template.id} className="glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base">{template.name}</h3>
                    {template.items.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {template.items.length} blocks &middot; {totalMinutes(template.items)} min
                      </span>
                    )}
                    {template.items.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {template.items.map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                            <span className="flex-1">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{item.duration_minutes} min</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(template)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted/50 transition-all"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
