"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/rich-editor";
import type { Drill } from "@/lib/scoring/types";
import { NavArrowLeft, Trash, EditPencil } from "iconoir-react";

const CATEGORIES = ["General", "Warm Up", "Hitting", "Fielding", "Throwing", "Baserunning", "Conditioning", "Team", "Game", "Catcher"];

export default function DrillLibraryPage() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("General");
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    loadDrills();
  }, []);

  async function loadDrills() {
    const { data } = await supabase
      .from("drills")
      .select("*")
      .order("category")
      .order("name");
    setDrills(data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setDescription("");
    setDuration("");
    setCategory("General");
    setEditingDrill(null);
    setShowNew(false);
  }

  function startEdit(drill: Drill) {
    setEditingDrill(drill);
    setName(drill.name);
    setDescription(drill.description);
    setDuration(drill.duration_minutes?.toString() ?? "");
    setCategory(drill.category);
    setShowNew(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description,
      duration_minutes: duration ? parseInt(duration) : null,
      category,
      updated_at: new Date().toISOString(),
    };

    if (editingDrill) {
      await supabase.from("drills").update(payload).eq("id", editingDrill.id);
    } else {
      await supabase.from("drills").insert(payload);
    }

    resetForm();
    await loadDrills();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this drill?")) return;
    await supabase.from("drills").delete().eq("id", id);
    setDrills(drills.filter((d) => d.id !== id));
  }

  const filtered = filterCategory
    ? drills.filter((d) => d.category === filterCategory)
    : drills;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <Link href="/schedule" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
        <NavArrowLeft width={16} height={16} />
        Schedule
      </Link>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">Drill Library</h1>
        <Button
          className="h-11 px-5 text-base active:scale-95 transition-transform glow-primary"
          onClick={() => { showNew ? resetForm() : setShowNew(true); }}
        >
          {showNew ? "Cancel" : "New Drill"}
        </Button>
      </div>

      {/* Create / Edit form */}
      {showNew && (
        <Card className="glass animate-slide-up gradient-border">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Drill name"
                  className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Duration (min)</label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="10"
                  className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
                />
              </div>
            </div>

            {/* Category chips */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1 block">Category</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 select-none ${
                      category === cat
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-muted/30 text-muted-foreground border-border/50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1 block">Description</label>
              <RichEditor
                content={description}
                onChange={(html) => setDescription(html)}
                placeholder="Describe the drill, setup, variations..."
              />
            </div>

            <Button
              className="w-full h-12 text-base font-bold glow-primary active:scale-[0.98] transition-transform"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : editingDrill ? "Update Drill" : "Save Drill"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Category filter */}
      {drills.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 select-none ${
              !filterCategory
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-muted/30 text-muted-foreground border-border/50"
            }`}
          >
            All ({drills.length})
          </button>
          {CATEGORIES.filter((cat) => drills.some((d) => d.category === cat)).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 select-none ${
                filterCategory === cat
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-muted/30 text-muted-foreground border-border/50"
              }`}
            >
              {cat} ({drills.filter((d) => d.category === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Drill list */}
      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {drills.length === 0
            ? 'No drills yet. Tap "New Drill" to build your library!'
            : "No drills in this category."}
        </p>
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map((drill) => (
            <Card key={drill.id} className="glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-base">{drill.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                        {drill.category}
                      </span>
                      {drill.duration_minutes && (
                        <span className="text-xs text-muted-foreground">{drill.duration_minutes} min</span>
                      )}
                    </div>
                    {drill.description && !isEmptyHtml(drill.description) && (
                      <div
                        className="text-sm prose prose-invert prose-sm max-w-none text-muted-foreground drill-library-content"
                        dangerouslySetInnerHTML={{ __html: drill.description }}
                      />
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(drill)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all"
                      title="Edit"
                    >
                      <EditPencil width={14} height={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(drill.id)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted/50 transition-all"
                      title="Delete"
                    >
                      <Trash width={14} height={14} />
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

function isEmptyHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}
