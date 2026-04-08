"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Practice, Drill, PracticePlanItem, SquadGroup, SquadMember, Player } from "@/lib/scoring/types";
import { firstName } from "@/lib/player-name";
import { OpenBook, MapPin, Group, NavArrowDown, NavArrowRight } from 'iconoir-react'

function isEmptyHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

const GROUP_COLORS = [
  { bg: "bg-teal-500/20", text: "text-teal-400", border: "border-teal-500/40" },
  { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/40" },
  { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/40" },
  { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/40" },
  { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-500/40" },
  { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/40" },
];

export default function SharedPracticePage() {
  const params = useParams();
  const practiceId = params.practiceId as string;

  const [practice, setPractice] = useState<Practice | null>(null);
  const [planItems, setPlanItems] = useState<PracticePlanItem[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [squadGroups, setSquadGroups] = useState<SquadGroup[]>([]);
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedGroupDrill, setExpandedGroupDrill] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [practiceRes, planRes, drillsRes, groupsRes, membersRes, playersRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("drills").select("*").order("name"),
        supabase.from("practice_squad_groups").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_squad_members").select("*"),
        supabase.from("players").select("*").order("sort_order"),
      ]);

      setPractice(practiceRes.data);
      const allItems = planRes.data ?? [];
      setPlanItems(allItems);
      setDrills(drillsRes.data ?? []);

      const groups = (groupsRes.data ?? []) as SquadGroup[];
      setSquadGroups(groups);
      const groupIds = new Set(groups.map((g) => g.id));
      setSquadMembers(((membersRes.data ?? []) as SquadMember[]).filter((m) => groupIds.has(m.group_id)));
      setPlayers(playersRes.data ?? []);
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

  const topLevelItems = planItems.filter((i) => !i.group_id);
  const totalMinutes = topLevelItems.reduce((s, i) => s + i.duration_minutes, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 px-4">
      {/* Header */}
      <div className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <OpenBook width={18} height={18} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Practice Plan</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gradient">{practice.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(practice.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        {practice.venue && (
          <div className="flex items-center gap-2 mt-1.5">
            <MapPin width={14} height={14} className="text-primary shrink-0" />
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
        {topLevelItems.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {topLevelItems.length} block{topLevelItems.length !== 1 ? "s" : ""} &middot; {totalMinutes} min total
          </p>
        )}
      </div>

      {/* Plan Items */}
      {topLevelItems.length > 0 ? (
        <div className="space-y-2">
          {topLevelItems.map((item, idx) => {
            const drill = getDrill(item.drill_id);
            const isExpanded = expandedItem === item.id;
            const hasDetails = drill?.description && !isEmptyHtml(drill.description);
            const isSquadSplit = item.label === "Squad Split" && !item.drill_id;

            return (
              <Card key={item.id} className="glass overflow-visible">
                <div
                  className={`flex items-center gap-3 p-4 ${hasDetails ? "cursor-pointer" : ""}`}
                  onClick={() => hasDetails && setExpandedItem(isExpanded ? null : item.id)}
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 shrink-0 flex items-center justify-center text-sm font-bold text-primary">
                    {isSquadSplit ? (
                      <Group width={14} height={14} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {isSquadSplit
                        ? `${squadGroups.length} group${squadGroups.length !== 1 ? "s" : ""}`
                        : `${item.duration_minutes} min${drill?.category ? ` · ${drill.category}` : ""}`}
                    </div>
                  </div>
                  {hasDetails && (
                    <NavArrowDown
                      width={16}
                      height={16}
                      className={`shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  )}
                </div>

                {/* Expanded drill details */}
                {isExpanded && drill?.description && !isEmptyHtml(drill.description) && (
                  <div className="px-4 pb-4 border-t border-border/30">
                    <div
                      className="text-sm prose prose-invert prose-sm max-w-none mt-3"
                      dangerouslySetInnerHTML={{ __html: drill.description }}
                    />
                  </div>
                )}

                {/* Squad Split — groups with drills and players */}
                {isSquadSplit && squadGroups.length > 0 && (
                  <div className="px-4 pb-4 border-t border-border/30 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {squadGroups.map((group) => {
                        const color = GROUP_COLORS[group.color_index % GROUP_COLORS.length];
                        const groupDrills = planItems.filter((i) => i.group_id === group.id);
                        const groupPlayers = squadMembers
                          .filter((m) => m.group_id === group.id)
                          .map((m) => players.find((p) => p.id === m.player_id))
                          .filter((p): p is Player => !!p);

                        return (
                          <div
                            key={group.id}
                            className={`rounded-xl border-2 ${color.border} ${color.bg} p-2.5 space-y-2`}
                          >
                            <div className={`text-xs font-bold ${color.text}`}>{group.name}</div>

                            {/* Drills */}
                            {groupDrills.length > 0 && (
                              <div className="space-y-1">
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

                            {/* Players */}
                            {groupPlayers.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1 border-t border-white/10">
                                {groupPlayers.map((p) => (
                                  <span
                                    key={p.id}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color.bg} ${color.text} border ${color.border}`}
                                  >
                                    #{p.number} {firstName(p)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {groupDrills.length === 0 && groupPlayers.length === 0 && (
                              <p className="text-[10px] text-muted-foreground italic">No drills or players assigned.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
