"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VenuePicker } from "@/components/venue-picker";
import type { Practice } from "@/lib/scoring/types";

export default function PracticesPage() {
  const router = useRouter();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("Practice");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newVenue, setNewVenue] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("practices").select("*").order("date", { ascending: false });
      setPractices(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">Practices</h1>
        <Button
          className="h-11 px-5 text-base active:scale-95 transition-transform glow-primary"
          onClick={() => setShowNew(!showNew)}
        >
          {showNew ? "Cancel" : "Log Practice"}
        </Button>
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href="/practices/drills"
          className="flex-1 rounded-xl border-2 border-border/50 bg-muted/30 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <div className="font-semibold text-sm group-hover:text-primary transition-colors">Drill Library</div>
          <div className="text-xs text-muted-foreground">Create & manage reusable drills</div>
        </Link>
        <Link
          href="/practices/templates"
          className="flex-1 rounded-xl border-2 border-border/50 bg-muted/30 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all group"
        >
          <div className="font-semibold text-sm group-hover:text-primary transition-colors">Plan Templates</div>
          <div className="text-xs text-muted-foreground">Pre-built practice structures</div>
        </Link>
      </div>

      {showNew && (
        <Card className="glass animate-slide-up">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Title</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Practice"
                  className="h-12 text-base bg-input/50 border-border/50 focus:border-primary/50"
                />
              </div>
              <div className="overflow-hidden">
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Date</label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-12 text-base w-full bg-input/50 border-border/50 focus:border-primary/50"
                />
              </div>
            </div>
            {/* Venue */}
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
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? "Creating..." : "Start Practice Log"}
            </Button>
          </CardContent>
        </Card>
      )}

      {practices.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No practices logged yet. Tap &quot;Log Practice&quot; to get started!</p>
      ) : (
        <div className="space-y-3 stagger-children">
          {practices.map((p) => (
            <Link key={p.id} href={`/practices/${p.id}`}>
              <Card className="card-hover glass mb-3">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-base">{p.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {p.venue && <span className="ml-2">@ {p.venue}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
