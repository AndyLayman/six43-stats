"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Practice, Drill, PracticePlanItem, PracticeNote, ActionItem, PracticeAttendance, Player, SquadGroup, SquadMember, ChainAward } from "@/lib/scoring/types";
import { firstName, fullName } from "@/lib/player-name";

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

const FOCUS_COLORS: Record<string, { bg: string; text: string }> = {
  Hitting: { bg: "#FEF3C7", text: "#92400E" },
  Fielding: { bg: "#DBEAFE", text: "#1E40AF" },
  Throwing: { bg: "#FCE7F3", text: "#9D174D" },
  Baserunning: { bg: "#D1FAE5", text: "#065F46" },
  Attitude: { bg: "#EDE9FE", text: "#5B21B6" },
  Other: { bg: "#F3F4F6", text: "#374151" },
};

export default function SharedPracticePage() {
  const params = useParams();
  const practiceId = params.practiceId as string;

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
    async function load() {
      const [practiceRes, planRes, drillsRes, notesRes, actionRes, attendanceRes, playersRes, groupsRes, membersRes, awardsRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("drills").select("*").order("name"),
        supabase.from("practice_notes").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("action_items").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("practice_attendance").select("*").eq("practice_id", practiceId),
        supabase.from("players").select("*").order("sort_order"),
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
  }, [practiceId]);

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
      <div className="share-page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #DDD", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="share-page" style={{ textAlign: "center", padding: "80px 20px", color: "#999", fontFamily: "'Montserrat', sans-serif" }}>
        Practice not found
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

  function getDrill(drillId: string | null): Drill | undefined {
    if (!drillId) return undefined;
    return drills.find((d) => d.id === drillId);
  }

  const completionPct = topLevelItems.length > 0
    ? Math.round((completedItems.length / topLevelItems.length) * 100)
    : 0;

  return (
    <div style={{ background: "#111111", minHeight: "100vh", fontFamily: "'Montserrat', sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#111", color: "#FFF", padding: "0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Link href="/schedule" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
              ← Back
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {shareMsg && <span style={{ fontSize: 12, color: "#FFC425" }}>{shareMsg}</span>}
              <button
                onClick={handleShare}
                style={{
                  fontSize: 12, fontWeight: 600, color: "#111", background: "#FFC425",
                  border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                Share
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <svg width="20" height="17" viewBox="0 0 33 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.82602 3.80953C11.9054 -1.26984 20.1407 -1.26984 25.2201 3.80953L31.3444 9.93381C32.28 10.8695 32.2801 12.3865 31.3444 13.3222L17.7173 26.9492C16.7816 27.8849 15.2646 27.8849 14.3289 26.9492L0.701741 13.3222C-0.233923 12.3865 -0.233904 10.8695 0.701741 9.93381L6.82602 3.80953ZM16.9149 3.21411C16.3178 3.15929 15.7168 3.16214 15.1202 3.22257L14.8005 3.255C13.4619 3.3906 12.1692 3.81828 11.0138 4.50791C10.5194 4.80305 10.0537 5.14404 9.62298 5.52628L9.19067 5.91001C8.90516 6.1634 9.03836 6.63444 9.41429 6.70075L14.6669 7.62732C17.3189 8.09514 19.9345 8.75021 22.4939 9.58752L27.7916 11.3205C28.0221 11.3959 28.1955 11.1072 28.0207 10.9391L22.758 5.88093L21.7436 5.103C20.3447 4.03017 18.6705 3.37528 16.9149 3.21411Z" fill="#FFC425"/>
            </svg>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>
              {practice.title}
            </h1>
          </div>
          <p style={{ fontSize: 13, fontWeight: 400, margin: 0, color: "rgba(255,255,255,0.5)" }}>
            {formatFullDate(practice.date)}
            {practice.venue ? ` · ${practice.venue}` : ""}
          </p>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 20px 40px" }}>

        {/* Quick Stats Row */}
        {(attendance.size > 0 || topLevelItems.length > 0) && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {attendance.size > 0 && (
              <div style={{ flex: 1, background: "#FFF", borderRadius: 12, padding: "16px 16px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#111", lineHeight: 1 }}>{presentPlayers.length}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#999", marginTop: 4 }}>Players Present</div>
              </div>
            )}
            {topLevelItems.length > 0 && (
              <div style={{ flex: 1, background: "#FFF", borderRadius: 12, padding: "16px 16px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#111", lineHeight: 1 }}>{completionPct}%</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#999", marginTop: 4 }}>Plan Completed</div>
              </div>
            )}
            {attendance.size > 0 && absentPlayers.length > 0 && (
              <div style={{ flex: 1, background: "#FFF", borderRadius: 12, padding: "16px 16px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#111", lineHeight: 1 }}>{absentPlayers.length}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#999", marginTop: 4 }}>Absent</div>
              </div>
            )}
          </div>
        )}

        {/* Chain Awards */}
        {chainAwards.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {chainAwards.map((award) => {
              const player = players.find((p) => p.id === award.player_id);
              if (!player) return null;
              const isGameChain = award.award_type === "game_chain";
              return (
                <div
                  key={award.id}
                  style={{
                    flex: 1, borderRadius: 12, padding: "16px",
                    background: isGameChain
                      ? "linear-gradient(135deg, #FEF3C7, #FDE68A)"
                      : "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>
                    {isGameChain ? "🏆" : "💪"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: isGameChain ? "#92400E" : "#1E40AF", marginBottom: 2 }}>
                    {isGameChain ? "Game Chain" : "Hard Worker"}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: isGameChain ? "#78350F" : "#1E3A8A" }}>
                    {fullName(player)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Absent Players */}
        {absentPlayers.length > 0 && (
          <div style={{ background: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 10px" }}>Absent</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {absentPlayers.map((p) => (
                <span key={p.id} style={{ fontSize: 12, fontWeight: 500, color: "#666", background: "#F3F4F6", borderRadius: 6, padding: "4px 10px" }}>
                  {firstName(p)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* What We Covered */}
        {topLevelItems.length > 0 && (
          <div style={{ background: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 12px" }}>
              What We Covered
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {topLevelItems.map((item, i) => {
                const isSquadSplit = item.label === "Squad Split" && !item.drill_id;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                      borderTop: i > 0 ? "1px solid #F3F4F6" : "none",
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: item.completed ? "#111" : "#F3F4F6",
                      color: item.completed ? "#FFF" : "#CCC",
                      fontSize: 12,
                    }}>
                      {item.completed ? "✓" : ""}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: item.completed ? 600 : 400, color: item.completed ? "#111" : "#888" }}>
                        {item.label}
                      </span>
                    </div>
                    {!isSquadSplit && item.duration_minutes > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#BBB", flexShrink: 0 }}>
                        {item.duration_minutes}m
                      </span>
                    )}
                    {isSquadSplit && squadGroups.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#BBB", flexShrink: 0 }}>
                        {squadGroups.length} groups
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Team Notes */}
        {practice.notes && !isEmptyHtml(practice.notes) && (
          <div style={{ background: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 10px" }}>Team Notes</h2>
            <div
              style={{ fontSize: 13, fontWeight: 400, lineHeight: 1.6, color: "#333" }}
              dangerouslySetInnerHTML={{ __html: practice.notes }}
            />
          </div>
        )}

        {/* Player Notes */}
        {notesByPlayer.size > 0 && (
          <div style={{ background: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 12px" }}>Player Notes</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[...notesByPlayer.entries()].map(([pid, playerNotes]) => {
                const player = players.find((p) => p.id === pid);
                if (!player) return null;
                return (
                  <div key={pid}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: "#FFF", background: "#111",
                        borderRadius: 6, padding: "3px 7px", lineHeight: 1,
                      }}>
                        {player.number}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                        {fullName(player)}
                      </span>
                    </div>
                    {playerNotes.map((n) => (
                      <div key={n.id} style={{ marginLeft: 0, marginBottom: 4 }}>
                        {n.focus_area && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                            borderRadius: 4, padding: "2px 6px", marginRight: 6, display: "inline-block",
                            background: FOCUS_COLORS[n.focus_area]?.bg ?? "#F3F4F6",
                            color: FOCUS_COLORS[n.focus_area]?.text ?? "#374151",
                          }}>
                            {n.focus_area}
                          </span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 400, color: "#444", lineHeight: 1.5 }}>
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
          <div style={{ background: "#FFF", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 12px" }}>Action Items</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {actionItems.map((item, i) => {
                const player = item.player_id ? players.find((p) => p.id === item.player_id) : null;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0",
                      borderTop: i > 0 ? "1px solid #F3F4F6" : "none",
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: item.completed ? "#111" : "#FFF",
                      border: item.completed ? "none" : "2px solid #DDD",
                      color: item.completed ? "#FFF" : "transparent",
                      fontSize: 12, marginTop: 1,
                    }}>
                      {item.completed ? "✓" : ""}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 400, color: item.completed ? "#999" : "#333",
                        textDecoration: item.completed ? "line-through" : "none",
                      }}>
                        {item.text}
                      </span>
                      {player && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#BBB", marginLeft: 6 }}>
                          #{player.number}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "24px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="14" height="12" viewBox="0 0 33 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.82602 3.80953C11.9054 -1.26984 20.1407 -1.26984 25.2201 3.80953L31.3444 9.93381C32.28 10.8695 32.2801 12.3865 31.3444 13.3222L17.7173 26.9492C16.7816 27.8849 15.2646 27.8849 14.3289 26.9492L0.701741 13.3222C-0.233923 12.3865 -0.233904 10.8695 0.701741 9.93381L6.82602 3.80953ZM16.9149 3.21411C16.3178 3.15929 15.7168 3.16214 15.1202 3.22257L14.8005 3.255C13.4619 3.3906 12.1692 3.81828 11.0138 4.50791C10.5194 4.80305 10.0537 5.14404 9.62298 5.52628L9.19067 5.91001C8.90516 6.1634 9.03836 6.63444 9.41429 6.70075L14.6669 7.62732C17.3189 8.09514 19.9345 8.75021 22.4939 9.58752L27.7916 11.3205C28.0221 11.3959 28.1955 11.1072 28.0207 10.9391L22.758 5.88093L21.7436 5.103C20.3447 4.03017 18.6705 3.37528 16.9149 3.21411Z" fill="#CCC"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#CCC" }}>Six43</span>
          </div>
        </div>
      </main>
    </div>
  );
}
