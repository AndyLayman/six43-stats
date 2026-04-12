"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import html2canvas from "html2canvas";
import { supabase } from "@/lib/supabase";
import type { Practice, Drill, PracticePlanItem, PracticeNote, ActionItem, PracticeAttendance, Player, SquadGroup, SquadMember } from "@/lib/scoring/types";
import { firstName, fullName } from "@/lib/player-name";

const LETTER_RATIO = 11 / 8.5;
const PAGE_PAD = 16;
const PAGE_GAP = 10;
const FOOTER_H = 20;

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

  const [practice, setPractice] = useState<Practice | null>(null);
  const [planItems, setPlanItems] = useState<PracticePlanItem[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [notes, setNotes] = useState<PracticeNote[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [attendance, setAttendance] = useState<Map<number, boolean>>(new Map());
  const [players, setPlayers] = useState<Player[]>([]);
  const [squadGroups, setSquadGroups] = useState<SquadGroup[]>([]);
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareMsg, setShareMsg] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [innerH, setInnerH] = useState(0);
  const [recapH, setRecapH] = useState(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [practiceRes, planRes, drillsRes, notesRes, actionRes, attendanceRes, playersRes, groupsRes, membersRes] = await Promise.all([
        supabase.from("practices").select("*").eq("id", practiceId).single(),
        supabase.from("practice_plan_items").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("drills").select("*").order("name"),
        supabase.from("practice_notes").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("action_items").select("*").eq("practice_id", practiceId).order("created_at"),
        supabase.from("practice_attendance").select("*").eq("practice_id", practiceId),
        supabase.from("players").select("*").order("sort_order"),
        supabase.from("practice_squad_groups").select("*").eq("practice_id", practiceId).order("sort_order"),
        supabase.from("practice_squad_members").select("*"),
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

      const attMap = new Map<number, boolean>();
      for (const a of (attendanceRes.data ?? []) as PracticeAttendance[]) {
        attMap.set(a.player_id, a.present);
      }
      setAttendance(attMap);
      setLoading(false);
    }
    load();
  }, [practiceId]);

  const measure = useCallback(() => {
    if (!paperRef.current || !measureRef.current) return;
    const pageW = paperRef.current.offsetWidth;
    const pageH = Math.round(pageW * LETTER_RATIO);
    const inner = pageH - 2 * PAGE_PAD;
    const measuredH = measureRef.current.offsetHeight;
    const needed = Math.max(1, Math.ceil((measuredH + FOOTER_H) / inner));
    setInnerH(inner);
    setRecapH(measuredH);
    setPageCount(needed);
  }, []);

  useLayoutEffect(() => { measure(); });

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", fontFamily: "'Montserrat', sans-serif" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #CCC", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!practice) {
    return <div style={{ textAlign: "center", padding: "80px 0", color: "#999", fontFamily: "'Montserrat', sans-serif" }}>Practice not found</div>;
  }

  const topLevelItems = planItems.filter((i) => !i.group_id);
  const completedItems = topLevelItems.filter((i) => i.completed);
  const presentPlayers = players.filter((p) => attendance.get(p.id) === true);
  const absentPlayers = players.filter((p) => attendance.get(p.id) === false);

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

  async function handleShare() {
    if (!paperRef.current) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(paperRef.current, {
        scale: 2,
        backgroundColor: "#E8E8E8",
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) { setCapturing(false); return; }

      const file = new File([blob], `${(practice?.title ?? "Practice").replace(/\s+/g, "_")}_Recap.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ title: `${practice?.title ?? "Practice"} Recap`, files: [file] });
        } catch { /* cancelled */ }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        setShareMsg("Image saved!");
        setTimeout(() => setShareMsg(""), 2000);
      }
    } catch {
      setShareMsg("Couldn't capture image");
      setTimeout(() => setShareMsg(""), 2000);
    }
    setCapturing(false);
  }

  // Spacer pushes footer to the bottom of the last page
  const spacerH = innerH > 0 ? Math.max(0, pageCount * innerH - recapH - FOOTER_H) : 0;

  // Recap content (rendered in each page viewport and in the measuring div)
  const recapContent = (
    <>
      {/* Logo + Header */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "8px" }}>
        <svg width="16" height="14" viewBox="0 0 33 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginRight: "8px", marginTop: "1px" }}>
          <path fillRule="evenodd" clipRule="evenodd" d="M6.82602 3.80953C11.9054 -1.26984 20.1407 -1.26984 25.2201 3.80953L31.3444 9.93381C32.28 10.8695 32.2801 12.3865 31.3444 13.3222L17.7173 26.9492C16.7816 27.8849 15.2646 27.8849 14.3289 26.9492L0.701741 13.3222C-0.233923 12.3865 -0.233904 10.8695 0.701741 9.93381L6.82602 3.80953ZM16.9149 3.21411C16.3178 3.15929 15.7168 3.16214 15.1202 3.22257L14.8005 3.255C13.4619 3.3906 12.1692 3.81828 11.0138 4.50791C10.5194 4.80305 10.0537 5.14404 9.62298 5.52628L9.19067 5.91001C8.90516 6.1634 9.03836 6.63444 9.41429 6.70075L14.6669 7.62732C17.3189 8.09514 19.9345 8.75021 22.4939 9.58752L27.7916 11.3205C28.0221 11.3959 28.1955 11.1072 28.0207 10.9391L22.758 5.88093L21.7436 5.103C20.3447 4.03017 18.6705 3.37528 16.9149 3.21411Z" fill="#111111"/>
        </svg>
        <div>
          <h1 style={{ fontSize: "12px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em", color: "#000" }}>
            {practice.title}
          </h1>
          <p style={{ fontSize: "8px", fontWeight: 400, margin: "1px 0 0", color: "#666" }}>
            {formatFullDate(practice.date)}
            {practice.venue ? ` · ${practice.venue}` : ""}
          </p>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #E0E0E0", margin: "0 0 8px" }} />

      {/* Attendance */}
      {attendance.size > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <h2 style={{ fontSize: "6px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 2px" }}>Attendance</h2>
          <p style={{ fontSize: "8px", fontWeight: 300, margin: "0 0 1px", color: "#333" }}>
            {presentPlayers.length} present{absentPlayers.length > 0 ? ` · ${absentPlayers.length} absent` : ""}
          </p>
          {absentPlayers.length > 0 && (
            <p style={{ fontSize: "8px", fontWeight: 300, color: "#888", margin: 0 }}>
              Absent: {absentPlayers.map((p) => `${firstName(p)}`).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* What We Covered */}
      {topLevelItems.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <h2 style={{ fontSize: "6px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 2px" }}>
            What We Covered
          </h2>
          <ul style={{ margin: 0, paddingLeft: "10px", fontSize: "8px", fontWeight: 300, lineHeight: 1.5, color: "#333" }}>
            {topLevelItems.map((item) => {
              const drill = getDrill(item.drill_id);
              const isSquadSplit = item.label === "Squad Split" && !item.drill_id;
              return (
                <li key={item.id}>
                  <span style={{ fontWeight: item.completed ? 400 : 300 }}>
                    {item.completed ? "✓ " : "○ "}
                    {item.label}
                  </span>
                  {!isSquadSplit && item.duration_minutes > 0 && (
                    <span style={{ color: "#999", fontSize: "7px" }}> ({item.duration_minutes} min)</span>
                  )}
                  {isSquadSplit && squadGroups.length > 0 && (
                    <span style={{ color: "#999", fontSize: "7px" }}> ({squadGroups.length} groups)</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p style={{ fontSize: "7px", fontWeight: 300, color: "#999", margin: "2px 0 0" }}>
            {completedItems.length}/{topLevelItems.length} completed
          </p>
        </div>
      )}

      {/* Team Notes */}
      {practice.notes && !isEmptyHtml(practice.notes) && (
        <div style={{ marginBottom: "8px" }}>
          <h2 style={{ fontSize: "6px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 2px" }}>Team Notes</h2>
          <div
            style={{ fontSize: "8px", fontWeight: 300, lineHeight: 1.4, color: "#333" }}
            dangerouslySetInnerHTML={{ __html: practice.notes }}
          />
        </div>
      )}

      {/* Player Notes */}
      {notesByPlayer.size > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <h2 style={{ fontSize: "6px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 2px" }}>Player Notes</h2>
          {[...notesByPlayer.entries()].map(([pid, playerNotes]) => {
            const player = players.find((p) => p.id === pid);
            if (!player) return null;
            return (
              <div key={pid} style={{ marginBottom: "3px" }}>
                <p style={{ fontSize: "8px", fontWeight: 600, color: "#222", margin: "0 0 1px" }}>
                  #{player.number} {fullName(player)}
                </p>
                {playerNotes.map((n) => (
                  <div key={n.id} style={{ fontSize: "8px", fontWeight: 300, lineHeight: 1.3, color: "#444", marginBottom: "1px", paddingLeft: "6px" }}>
                    {n.focus_area && (
                      <span style={{ fontSize: "6px", fontWeight: 700, color: "#888", textTransform: "uppercase", marginRight: "3px" }}>
                        {n.focus_area}
                      </span>
                    )}
                    {stripHtml(n.note)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div style={{ marginBottom: "4px" }}>
          <h2 style={{ fontSize: "6px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", margin: "0 0 2px" }}>Action Items</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "8px", fontWeight: 300, lineHeight: 1.5, color: "#333" }}>
            {actionItems.map((item) => {
              const player = item.player_id ? players.find((p) => p.id === item.player_id) : null;
              return (
                <li key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
                  <span style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    border: item.completed ? "none" : "1px solid #CCC",
                    borderRadius: "2px",
                    flexShrink: 0,
                    marginTop: "2px",
                    background: item.completed ? "#DDD" : "none",
                    textAlign: "center",
                    lineHeight: "8px",
                    fontSize: "6px",
                    color: "#888",
                  }}>
                    {item.completed ? "✓" : ""}
                  </span>
                  <span style={{ textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "#999" : "#333" }}>
                    {item.text}
                    {player && (
                      <span style={{ fontSize: "7px", color: "#999" }}> (#{player.number})</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );

  const footerContent = (
    <div>
      <hr style={{ border: "none", borderTop: "1px solid #EEE", margin: "0 0 4px" }} />
      <p style={{ fontSize: "6px", fontWeight: 300, color: "#BBB", textAlign: "center", margin: 0 }}>
        Shared from Six43
      </p>
    </div>
  );

  return (
    <div style={{ background: "#E8E8E8", minHeight: "100vh", padding: "16px 12px", fontFamily: "'Montserrat', sans-serif" }}>
      {/* Nav bar — outside the paper */}
      <div style={{ maxWidth: "540px", margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/schedule" style={{ fontSize: "11px", fontWeight: 500, color: "#666", textDecoration: "none" }}>
          ← Schedule
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {shareMsg && <span style={{ fontSize: "10px", color: "#3b82f6" }}>{shareMsg}</span>}
          <button
            onClick={handleShare}
            disabled={capturing}
            style={{
              fontSize: "11px", fontWeight: 600, color: "#FFF", background: capturing ? "#666" : "#111",
              border: "none", borderRadius: "6px", padding: "6px 12px", cursor: capturing ? "wait" : "pointer",
            }}
          >
            {capturing ? "Capturing..." : "Share as Photo"}
          </button>
        </div>
      </div>

      {/* Separate page cards */}
      <div ref={paperRef} style={{ maxWidth: "540px", margin: "0 auto", background: "#E8E8E8", padding: "2px 0", position: "relative" }}>
        {/* Hidden measuring div — same inner width as page cards */}
        <div style={{
          position: "absolute", visibility: "hidden",
          top: 0, left: PAGE_PAD, right: PAGE_PAD,
          pointerEvents: "none", zIndex: -1,
        }}>
          <div ref={measureRef}>{recapContent}</div>
        </div>

        {Array.from({ length: pageCount }).map((_, i) => {
          const pageH = innerH > 0 ? innerH + 2 * PAGE_PAD : undefined;
          return (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                height: pageH,
                aspectRatio: pageH ? undefined : "8.5 / 11",
                borderRadius: "6px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
                overflow: "hidden",
                padding: PAGE_PAD,
                marginBottom: i < pageCount - 1 ? PAGE_GAP : 0,
              }}
            >
              {/* Inner clip viewport */}
              <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  transform: innerH > 0 ? `translateY(${-i * innerH}px)` : undefined,
                }}>
                  {recapContent}
                  <div style={{ height: spacerH }} />
                  {footerContent}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
