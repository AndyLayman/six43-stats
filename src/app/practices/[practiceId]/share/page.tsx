"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Practice, Drill, PracticePlanItem } from "@/lib/scoring/types";

function isEmptyHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export default function SharedPracticePage() {
  const params = useParams();
  const practiceId = params.practiceId as string;

  const [practice, setPractice] = useState<Practice | null>(null);
  const [planItems, setPlanItems] = useState<PracticePlanItem[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [practiceRes, planRes, drillsRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("drills").select("*").order("name"),
      ]);

      setPractice(practiceRes.data);
      setPlanItems(planRes.data ?? []);
      setDrills(drillsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [practiceId]);

  function getDrill(drillId: string | null): Drill | undefined {
    if (!drillId) return undefined;
    return drills.find((d) => d.id === drillId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!practice) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Practice not found</div>;
  }

  const totalMinutes = planItems.reduce((s, i) => s + i.duration_minutes, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 px-4">
      {/* Header */}
      <div className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Practice Plan</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">{practice.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(practice.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        {practice.venue && (
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
        {planItems.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {planItems.length} block{planItems.length !== 1 ? "s" : ""} &middot; {totalMinutes} min total
          </p>
        )}
      </div>

      {/* Plan Items */}
      {planItems.length > 0 ? (
        <div className="space-y-2">
          {planItems.map((item, idx) => {
            const drill = getDrill(item.drill_id);
            const isExpanded = expandedItem === item.id;
            const hasDetails = drill?.description && !isEmptyHtml(drill.description);

            return (
              <Card key={item.id} className="glass overflow-hidden">
                <div
                  className={`flex items-center gap-3 p-4 ${hasDetails ? "cursor-pointer" : ""}`}
                  onClick={() => hasDetails && setExpandedItem(isExpanded ? null : item.id)}
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 shrink-0 flex items-center justify-center text-sm font-bold text-primary">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.duration_minutes} min{drill?.category ? ` · ${drill.category}` : ""}
                    </div>
                  </div>
                  {hasDetails && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </div>

                {isExpanded && drill?.description && !isEmptyHtml(drill.description) && (
                  <div className="px-4 pb-4 border-t border-border/30">
                    <div
                      className="text-sm prose prose-invert prose-sm max-w-none mt-3"
                      dangerouslySetInnerHTML={{ __html: drill.description }}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">No practice plan set up yet.</p>
      )}

      {/* Team Notes (read-only) */}
      {practice.notes && !isEmptyHtml(practice.notes) && (
        <Card className="glass">
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Team Notes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div
              className="text-sm prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: practice.notes }}
            />
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>Shared from Baseball Stats</p>
      </div>
    </div>
  );
}
