"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Practice, Drill, PracticePlanItem, PracticeNote, ActionItem, PracticeAttendance, Player, SquadGroup, SquadMember, ChainAward } from "@/lib/scoring/types";
import { firstName, fullName } from "@/lib/player-name";
import { useAuth } from "@/components/auth-provider";
import { Trophy, Gym, NavArrowLeft, ShareAndroid, Check } from "iconoir-react";

function isEmptyHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function SharedPracticePage() {
  const params = useParams();
  const practiceId = params.practiceId as string;
  const { activeTeam } = useAuth();

  const [practice, setPractice] = useState<Practice | null>(null);
  const [planItems, setPlanItems] = useState<PracticePlanItem[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [notes, setNotes] = useState<PracticeNote[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [attendance, setAttendance] = useState<Map<number, boolean>>(new Map());
  const [players, setPlayers] = useState<Player[]>([]);
  const [squadGroups, setSquadGroups] = useState<SquadGroup[]>([]);
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [chainAwards, setChainAwards] = useState<ChainAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    if (!activeTeam) return;
    async function load() {
      const [practiceRes, planRes, drillsRes, notesRes, actionRes, attendanceRes, playersRes, groupsRes, membersRes, awardsRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).eq("team_id", activeTeam!.team_id).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("drills").select("*").eq("team_id", activeTeam!.team_id).order("name"),
        supabase.from("practice_notes").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("action_items").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("practice_attendance").select("*").eq("practice_id", practiceId),
        supabase.from("players").select("*").eq("team_id", activeTeam!.team_id).order("sort_order"),
        supabase.from("practice_squad_groups").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_squad_members").select("*"),
        supabase.from("chain_awards").select("*").eq("source_type", "practice").eq("source_id", practiceId),
      ]);

      setPractice(practiceRes.data);
      setPlanItems(planRes.data ?? []);
      setDrills(drillsRes.data ?? []);
      setNotes(notesRes.data ?? []);
      setActionItems(actionRes.data ?? []);
      setPlayers(playersRes.data ?? []);

      const groups = (groupsRes.data ?? []) as SquadGroup[];
      setSquadGroups(groups);
      const groupIds = new Set(groups.map((g) => g.id));
      setSquadMembers(((membersRes.data ?? []) as SquadMember[]).filter((m) => groupIds.has(m.group_id)));
      setChainAwards((awardsRes.data ?? []) as ChainAward[]);

      const attMap = new Map<number, boolean>();
      for (const a of (attendanceRes.data ?? []) as PracticeAttendance[]) {
        attMap.set(a.player_id, a.present);
      }
      setAttendance(attMap);
      setLoading(false);
    }
    load();
  }, [practiceId, activeTeam]);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${practice?.title ?? "Practice"} Recap`, url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!");
      setTimeout(() => setShareMsg(""), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Practice not found</div>
      </div>
    );
  }

  const topLevelItems = planItems.filter((i) => !i.group_id);
  const completedItems = topLevelItems.filter((i) => i.completed);
  const presentPlayers = players.filter((p) => attendance.get(p.id) === true);
  const absentPlayers = attendance.size > 0
    ? players.filter((p) => attendance.get(p.id) !== true)
    : [];

  const notesByPlayer = new Map<number, PracticeNote[]>();
  for (const n of notes) {
    const arr = notesByPlayer.get(n.player_id) ?? [];
    arr.push(n);
    notesByPlayer.set(n.player_id, arr);
  }

  const completionPct = topLevelItems.length > 0
    ? Math.round((completedItems.length / topLevelItems.length) * 100)
    : 0;

  const gameChain = chainAwards.find(a => a.award_type === "game_chain");
  const hardWorker = chainAwards.find(a => a.award_type === "hard_worker");
  const gameChainPlayer = gameChain ? players.find(p => p.id === gameChain.player_id) : null;
  const hardWorkerPlayer = hardWorker ? players.find(p => p.id === hardWorker.player_id) : null;

  return (
    <div className="min-h-screen bg-background -mx-4 -mt-4 sm:-mt-6">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link href="/schedule" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <NavArrowLeft width={16} height={16} />
              Back
            </Link>
            <div className="flex items-center gap-2">
              {shareMsg && <span className="text-xs text-primary">{shareMsg}</span>}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <ShareAndroid width={14} height={14} />
                Share
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <img src="/logos/Stats-White.svg" alt="Stats" className="h-5 w-auto dark:block hidden" />
            <img src="/logos/Stats-Black.svg" alt="Stats" className="h-5 w-auto dark:hidden block" />
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              {practice.title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatFullDate(practice.date)}
            {practice.venue ? ` · ${practice.venue}` : ""}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-xl mx-auto px-4 py-5 space-y-3">

        {/* Quick Stats Row */}
        {(attendance.size > 0 || topLevelItems.length > 0) && (
          <div className="flex gap-3">
            {attendance.size > 0 && (
              <div className="flex-1 rounded-xl border border-border/50 bg-card p-4">
                <div className="text-2xl font-extrabold text-foreground leading-none">{presentPlayers.length}</div>
                <div className="text-[11px] font-medium text-muted-foreground mt-1">Players Present</div>
              </div>
            )}
            {topLevelItems.length > 0 && (
              <div className="flex-1 rounded-xl border border-border/50 bg-card p-4">
                <div className="text-2xl font-extrabold text-foreground leading-none">{completionPct}%</div>
                <div className="text-[11px] font-medium text-muted-foreground mt-1">Plan Completed</div>
              </div>
            )}
            {attendance.size > 0 && absentPlayers.length > 0 && (
              <div className="flex-1 rounded-xl border border-border/50 bg-card p-4">
                <div className="text-2xl font-extrabold text-foreground leading-none">{absentPlayers.length}</div>
                <div className="text-[11px] font-medium text-muted-foreground mt-1">Absent</div>
              </div>
            )}
          </div>
        )}

        {/* Chain Awards */}
        {(gameChainPlayer || hardWorkerPlayer) && (
          <div className="flex gap-3">
            {gameChainPlayer && (
              <div className="flex-1 rounded-xl border border-border/50 bg-card p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Trophy width={16} height={16} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Game Chain</span>
                </div>
                <div className="text-sm font-bold text-foreground">{fullName(gameChainPlayer)}</div>
              </div>
            )}
            {hardWorkerPlayer && (
              <div className="flex-1 rounded-xl border border-border/50 bg-card p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Gym width={16} height={16} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hard Worker</span>
                </div>
                <div className="text-sm font-bold text-foreground">{fullName(hardWorkerPlayer)}</div>
              </div>
            )}
          </div>
        )}

        {/* Absent Players */}
        {absentPlayers.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Absent</h2>
            <div className="flex flex-wrap gap-1.5">
              {absentPlayers.map((p) => (
                <span key={p.id} className="text-xs font-medium text-muted-foreground bg-muted rounded-md px-2.5 py-1">
                  {firstName(p)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* What We Covered */}
        {topLevelItems.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              What We Covered
            </h2>
            <div className="space-y-0">
              {topLevelItems.map((item, i) => {
                const isSquadSplit = item.label === "Squad Split" && !item.drill_id;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 py-2.5"
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{
                        background: item.completed ? "var(--primary)" : "var(--muted)",
                        color: item.completed ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      }}
                    >
                      {item.completed && <Check width={12} height={12} />}
                    </div>
                    <span className={`text-sm flex-1 ${item.completed ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {item.label}
                    </span>
                    {!isSquadSplit && item.duration_minutes > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">{item.duration_minutes}m</span>
                    )}
                    {isSquadSplit && squadGroups.length > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">{squadGroups.length} groups</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Team Notes */}
        {practice.notes && !isEmptyHtml(practice.notes) && (
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Team Notes</h2>
            <div
              className="text-sm text-foreground/80 leading-relaxed [&>p]:mb-1.5 [&>ul]:pl-4 [&>ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: practice.notes }}
            />
          </div>
        )}

        {/* Player Notes */}
        {notesByPlayer.size > 0 && (
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Player Notes</h2>
            <div className="space-y-4">
              {[...notesByPlayer.entries()].map(([pid, playerNotes]) => {
                const player = players.find((p) => p.id === pid);
                if (!player) return null;
                return (
                  <div key={pid}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-primary-foreground bg-primary rounded px-1.5 py-0.5 leading-none">
                        {player.number}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {fullName(player)}
                      </span>
                    </div>
                    {playerNotes.map((n) => (
                      <div key={n.id} className="mb-1">
                        {n.focus_area && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5 mr-1.5 inline-block">
                            {n.focus_area}
                          </span>
                        )}
                        <span className="text-sm text-foreground/70">
                          {stripHtml(n.note)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Action Items</h2>
            <div className="space-y-0">
              {actionItems.map((item, i) => {
                const player = item.player_id ? players.find((p) => p.id === item.player_id) : null;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 py-2.5"
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-px"
                      style={{
                        background: item.completed ? "var(--primary)" : "transparent",
                        border: item.completed ? "none" : "2px solid var(--border)",
                        color: item.completed ? "var(--primary-foreground)" : "transparent",
                      }}
                    >
                      {item.completed && <Check width={12} height={12} />}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {item.text}
                      </span>
                      {player && (
                        <span className="text-xs text-muted-foreground ml-1.5">#{player.number}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 pt-4 pb-2">
          <svg width="14" height="12" viewBox="0 0 33 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M6.82602 3.80953C11.9054 -1.26984 20.1407 -1.26984 25.2201 3.80953L31.3444 9.93381C32.28 10.8695 32.2801 12.3865 31.3444 13.3222L17.7173 26.9492C16.7816 27.8849 15.2646 27.8849 14.3289 26.9492L0.701741 13.3222C-0.233923 12.3865 -0.233904 10.8695 0.701741 9.93381L6.82602 3.80953ZM16.9149 3.21411C16.3178 3.15929 15.7168 3.16214 15.1202 3.22257L14.8005 3.255C13.4619 3.3906 12.1692 3.81828 11.0138 4.50791C10.5194 4.80305 10.0537 5.14404 9.62298 5.52628L9.19067 5.91001C8.90516 6.1634 9.03836 6.63444 9.41429 6.70075L14.6669 7.62732C17.3189 8.09514 19.9345 8.75021 22.4939 9.58752L27.7916 11.3205C28.0221 11.3959 28.1955 11.1072 28.0207 10.9391L22.758 5.88093L21.7436 5.103C20.3447 4.03017 18.6705 3.37528 16.9149 3.21411Z" fill="var(--muted-foreground)" fillOpacity="0.5"/>
          </svg>
          <span className="text-[11px] font-medium text-muted-foreground/50">Six43</span>
        </div>
      </main>
    </div>
  );
}
