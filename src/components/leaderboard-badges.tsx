"use client";

import { useState } from "react";
import type { BattingStats, FieldingStats } from "@/lib/scoring/types";
import {
  Crown,
  Flash,
  Trophy,
  ShieldCheck,
  FireFlame,
  Running,
  HandCard,
  MultiplePagesEmpty,
  Eye,
} from "iconoir-react";
import type { ComponentType } from "react";

export interface Badge {
  id: string;
  Icon: ComponentType<{ width?: number; height?: number; className?: string }>;
  label: string;
  description: string;
}

const BADGE_DEFS: Badge[] = [
  { id: "batting-champ", Icon: Crown, label: "Batting Champ", description: "Highest batting average on the team" },
  { id: "power-hitter", Icon: Flash, label: "Power Hitter", description: "Most home runs on the team" },
  { id: "run-producer", Icon: Trophy, label: "Run Producer", description: "Most RBIs on the team" },
  { id: "on-base-king", Icon: ShieldCheck, label: "On-Base King", description: "Highest on-base percentage on the team" },
  { id: "slugger", Icon: FireFlame, label: "Slugger", description: "Highest slugging percentage on the team" },
  { id: "speed-demon", Icon: Running, label: "Speed Demon", description: "Most stolen bases on the team" },
  { id: "golden-glove", Icon: HandCard, label: "Golden Glove", description: "Best fielding percentage on the team (min 1 total chance)" },
  { id: "hit-machine", Icon: MultiplePagesEmpty, label: "Hit Machine", description: "Most hits on the team" },
  { id: "patient-eye", Icon: Eye, label: "Patient Eye", description: "Most walks on the team" },
];

export function computeBadges(
  batting: BattingStats[],
  fielding: FieldingStats[]
): Map<number, Badge[]> {
  const map = new Map<number, Badge[]>();

  const qualified = batting.filter((s) => Number(s.at_bats) > 0);
  if (qualified.length === 0) return map;

  function award(playerId: number, badge: Badge) {
    const existing = map.get(playerId) ?? [];
    existing.push(badge);
    map.set(playerId, existing);
  }

  const byAvg = [...qualified].sort((a, b) => Number(b.avg) - Number(a.avg));
  if (byAvg.length > 0) award(byAvg[0].player_id, BADGE_DEFS[0]);

  const byHR = [...qualified].sort((a, b) => Number(b.home_runs) - Number(a.home_runs));
  if (byHR.length > 0 && Number(byHR[0].home_runs) > 0) award(byHR[0].player_id, BADGE_DEFS[1]);

  const byRBI = [...qualified].sort((a, b) => Number(b.rbis) - Number(a.rbis));
  if (byRBI.length > 0 && Number(byRBI[0].rbis) > 0) award(byRBI[0].player_id, BADGE_DEFS[2]);

  const byOBP = [...qualified].sort((a, b) => Number(b.obp) - Number(a.obp));
  if (byOBP.length > 0) award(byOBP[0].player_id, BADGE_DEFS[3]);

  const bySLG = [...qualified].sort((a, b) => Number(b.slg) - Number(a.slg));
  if (bySLG.length > 0) award(bySLG[0].player_id, BADGE_DEFS[4]);

  const bySB = [...qualified].sort((a, b) => Number(b.stolen_bases) - Number(a.stolen_bases));
  if (bySB.length > 0 && Number(bySB[0].stolen_bases) > 0) award(bySB[0].player_id, BADGE_DEFS[5]);

  const qualifiedFielding = fielding.filter((s) => Number(s.total_chances) > 0);
  const byFld = [...qualifiedFielding].sort((a, b) => Number(b.fielding_pct) - Number(a.fielding_pct));
  if (byFld.length > 0) award(byFld[0].player_id, BADGE_DEFS[6]);

  const byH = [...qualified].sort((a, b) => Number(b.hits) - Number(a.hits));
  if (byH.length > 0 && Number(byH[0].hits) > 0) award(byH[0].player_id, BADGE_DEFS[7]);

  const byBB = [...qualified].sort((a, b) => Number(b.walks) - Number(a.walks));
  if (byBB.length > 0 && Number(byBB[0].walks) > 0) award(byBB[0].player_id, BADGE_DEFS[8]);

  return map;
}

export function BadgeRow({ badges }: { badges: Badge[] }) {
  const [activeBadge, setActiveBadge] = useState<Badge | null>(null);

  if (badges.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {badges.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => setActiveBadge(activeBadge?.id === b.id ? null : b)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border select-none transition-transform active:scale-95 border-primary/30 bg-primary/10 text-primary"
        >
          <b.Icon width={12} height={12} /> {b.label}
        </button>
      ))}
      {activeBadge && (
        <div className="basis-full text-xs text-muted-foreground mt-0.5 animate-fade-in">
          <span className="font-semibold text-primary">{activeBadge.label}:</span>{" "}
          {activeBadge.description}
        </div>
      )}
    </div>
  );
}
