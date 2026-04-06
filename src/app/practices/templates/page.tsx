"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PracticePlanTemplate, PracticePlanTemplateItem, Drill } from "@/lib/scoring/types";

interface TemplateWithItems extends PracticePlanTemplate {
  items: PracticePlanTemplateItem[];
}

export default function PlanTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // template id being edited
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Items being edited for a template
  const [editItems, setEditItems] = useState<{ label: string; duration_minutes: number; drill_id: string | null }[]>([]);

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
      // Automatically start editing
      setEditing(data.id);
      setEditItems([
        { label: "Warm-up", duration_minutes: 10, drill_id: null },
        { label: "Hitting Stations", duration_minutes: 20, drill_id: null },
        { label: "Fielding", duration_minutes: 15, drill_id: null },
        { label: "Scrimmage", duration_minutes: 20, drill_id: null },
        { label: "Cool-down", duration_minutes: 5, drill_id: null },
      ]);
    }
    setSaving(false);
  }

  function startEdit(template: TemplateWithItems) {
    setEditing(template.id);
    setEditItems(
      template.items.length > 0
        ? template.items.map((i) => ({ label: i.label, duration_minutes: i.duration_minutes, drill_id: i.drill_id }))
        : [{ label: "", duration_minutes: 10, drill_id: null }]
    );
  }

  function addItem() {
    setEditItems([...editItems, { label: "", duration_minutes: 10, drill_id: null }]);
  }

  function removeItem(idx: number) {
    setEditItems(editItems.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: string, value: string | number | null) {
    setEditItems(editItems.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function selectDrillForItem(idx: number, drillId: string) {
    const drill = drills.find((d) => d.id === drillId);
    if (drill) {
      setEditItems(
        editItems.map((item, i) =>
          i === idx
            ? { ...item, drill_id: drillId, label: drill.name, duration_minutes: drill.duration_minutes ?? item.duration_minutes }
            : item
        )
      );
    }
  }

  async function handleSaveItems() {
    if (!editing) return;
    setSaving(true);

    // Delete old items then insert new
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

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await supabase.from("practice_plan_templates").delete().eq("id", id);
    setTemplates(templates.filter((t) => t.id !== id));
  }

  const totalMinutes = (items: { duration_minutes: number }[]) =>
    items.reduce((sum, i) => sum + i.duration_minutes, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

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
                {editing === template.id ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base">{template.name}</h3>
                      <span className="text-xs text-muted-foreground">{totalMinutes(editItems)} min total</span>
                    </div>

                    {editItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                        <Input
                          value={item.label}
                          onChange={(e) => updateItem(idx, "label", e.target.value)}
                          placeholder="Block name"
                          className="flex-1 h-9 text-sm bg-input/50 border-border/50"
                        />
                        <Input
                          type="number"
                          value={item.duration_minutes}
                          onChange={(e) => updateItem(idx, "duration_minutes", parseInt(e.target.value) || 0)}
                          className="w-16 h-9 text-sm bg-input/50 border-border/50 text-center"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">min</span>
                        {drills.length > 0 && (
                          <select
                            value={item.drill_id ?? ""}
                            onChange={(e) => e.target.value ? selectDrillForItem(idx, e.target.value) : updateItem(idx, "drill_id", null)}
                            className="h-9 rounded-lg bg-muted/30 border border-border/50 px-2 text-xs max-w-[120px]"
                          >
                            <option value="">Link drill...</option>
                            {drills.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => removeItem(idx)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-all shrink-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <Button variant="outline" className="h-9 text-xs" onClick={addItem}>
                        + Add Block
                      </Button>
                      <div className="flex-1" />
                      <Button variant="outline" className="h-9 text-xs" onClick={() => { setEditing(null); setEditItems([]); }}>
                        Cancel
                      </Button>
                      <Button className="h-9 text-xs font-bold glow-primary" onClick={handleSaveItems} disabled={saving}>
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-base">{template.name}</h3>
                        {template.items.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {template.items.length} blocks &middot; {totalMinutes(template.items)} min
                          </span>
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
