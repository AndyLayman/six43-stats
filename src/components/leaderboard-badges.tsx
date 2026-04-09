"use client";

import type { BattingStats, FieldingStats } from "@/lib/scoring/types";

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  color: string;
}

const BADGE_DEFS: Badge[] = [
  { id: "batting-champ", emoji: "\u{1F451}", label: "Batting Champ", description: "Highest batting average", color: "#FFD700" },
  { id: "power-hitter", emoji: "\u{1F4A5}", label: "Power Hitter", description: "Most home runs", color: "#FF6161" },
  { id: "run-producer", emoji: "\u{1F3AF}", label: "Run Producer", description: "Most RBIs", color: "#f97316" },
  { id: "on-base-king", emoji: "\u{1F6E1}\uFE0F", label: "On-Base King", description: "Highest OBP", color: "#D4C29F" },
  { id: "slugger", emoji: "\u{1F525}", label: "Slugger", description: "Highest SLG", color: "#574F3D" },
  { id: "speed-demon", emoji: "\u{26A1}", label: "Speed Demon", description: "Most stolen bases", color: "#E9D7B4" },
  { id: "golden-glove", emoji: "\u{1F9E4}", label: "Golden Glove", description: "Best fielding percentage", color: "#FFD700" },
  { id: "hit-machine", emoji: "\u{1F3B0}", label: "Hit Machine", description: "Most hits", color: "#E9D7B4" },
  { id: "patient-eye", emoji: "\u{1F440}", label: "Patient Eye", description: "Most walks", color: "#D4C29F" },
];

export function computeBadges(
  batting: BattingStats[],
  fielding: FieldingStats[]
): Map<number, Badge[]> {
  const map = new Map<number, Badge[]>();

  // Only consider players with at least 1 AB
  const qualified = batting.filter((s) => Number(s.at_bats) > 0);
  if (qualified.length === 0) return map;

  function award(playerId: number, badge: Badge) {
    const existing = map.get(playerId) ?? [];
    existing.push(badge);
    map.set(playerId, existing);
  }

  // Batting Champ — highest AVG
  const byAvg = [...qualified].sort((a, b) => Number(b.avg) - Number(a.avg));
  if (byAvg.length > 0) award(byAvg[0].player_id, BADGE_DEFS[0]);

  // Power Hitter — most HR
  const byHR = [...qualified].sort((a, b) => Number(b.home_runs) - Number(a.home_runs));
  if (byHR.length > 0 && Number(byHR[0].home_runs) > 0) award(byHR[0].player_id, BADGE_DEFS[1]);

  // Run Producer — most RBI
  const byRBI = [...qualified].sort((a, b) => Number(b.rbis) - Number(a.rbis));
  if (byRBI.length > 0 && Number(byRBI[0].rbis) > 0) award(byRBI[0].player_id, BADGE_DEFS[2]);

  // On-Base King — highest OBP
  const byOBP = [...qualified].sort((a, b) => Number(b.obp) - Number(a.obp));
  if (byOBP.length > 0) award(byOBP[0].player_id, BADGE_DEFS[3]);

  // Slugger — highest SLG
  const bySLG = [...qualified].sort((a, b) => Number(b.slg) - Number(a.slg));
  if (bySLG.length > 0) award(bySLG[0].player_id, BADGE_DEFS[4]);

  // Speed Demon — most SB
  const bySB = [...qualified].sort((a, b) => Number(b.stolen_bases) - Number(a.stolen_bases));
  if (bySB.length > 0 && Number(bySB[0].stolen_bases) > 0) award(bySB[0].player_id, BADGE_DEFS[5]);

  // Golden Glove — best fielding % (min 1 TC)
  const qualifiedFielding = fielding.filter((s) => Number(s.total_chances) > 0);
  const byFld = [...qualifiedFielding].sort((a, b) => Number(b.fielding_pct) - Number(a.fielding_pct));
  if (byFld.length > 0) award(byFld[0].player_id, BADGE_DEFS[6]);

  // Hit Machine — most hits
  const byH = [...qualified].sort((a, b) => Number(b.hits) - Number(a.hits));
  if (byH.length > 0 && Number(byH[0].hits) > 0) award(byH[0].player_id, BADGE_DEFS[7]);

  // Patient Eye — most walks
  const byBB = [...qualified].sort((a, b) => Number(b.walks) - Number(a.walks));
  if (byBB.length > 0 && Number(byBB[0].walks) > 0) award(byBB[0].player_id, BADGE_DEFS[8]);

  return map;
}

export function BadgeRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {badges.map((b) => (
        <span
          key={b.id}
          title={`${b.label}: ${b.description}`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border select-none"
          style={{ borderColor: `${b.color}40`, backgroundColor: `${b.color}15`, color: b.color }}
        >
          {b.emoji} {b.label}
        </span>
      ))}
    </div>
  );
}
