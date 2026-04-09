"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { PlateAppearance } from "@/lib/scoring/types";
import { isAtBat, isHit } from "@/lib/stats/calculations";

type StatKey = "avg" | "obp" | "slg" | "ops";

const STAT_CONFIG: { key: StatKey; label: string; color: string }[] = [
  { key: "avg", label: "AVG", color: "#E9D7B4" },
  { key: "obp", label: "OBP", color: "#F7F7F7" },
  { key: "slg", label: "SLG", color: "#574F3D" },
  { key: "ops", label: "OPS", color: "#f97316" },
];

function totalBases(result: string): number {
  switch (result) {
    case "1B": return 1;
    case "2B": return 2;
    case "3B": return 3;
    case "HR": return 4;
    default: return 0;
  }
}

interface Props {
  appearances: PlateAppearance[];
  gameLog: { game_id: string; date: string; opponent: string; appearances: PlateAppearance[] }[];
}

export function ProgressionChart({ appearances, gameLog }: Props) {
  const [activeStat, setActiveStat] = useState<StatKey>("avg");

  const data = useMemo(() => {
    if (gameLog.length === 0) return [];

    // Sort games chronologically
    const sorted = [...gameLog].sort((a, b) => a.date.localeCompare(b.date));

    let cumHits = 0;
    let cumAB = 0;
    let cumBB = 0;
    let cumHBP = 0;
    let cumSAC = 0;
    let cumTB = 0;

    return sorted.map((game) => {
      for (const pa of game.appearances) {
        const ab = isAtBat(pa.result);
        const hit = isHit(pa.result);
        if (ab) cumAB++;
        if (hit) cumHits++;
        if (pa.result === "BB") cumBB++;
        if (pa.result === "HBP") cumHBP++;
        if (pa.result === "SAC") cumSAC++;
        cumTB += totalBases(pa.result);
      }

      const avg = cumAB > 0 ? cumHits / cumAB : 0;
      const obpDenom = cumAB + cumBB + cumHBP + cumSAC;
      const obp = obpDenom > 0 ? (cumHits + cumBB + cumHBP) / obpDenom : 0;
      const slg = cumAB > 0 ? cumTB / cumAB : 0;

      return {
        label: `${game.date.slice(5)} vs ${game.opponent}`,
        date: game.date,
        avg: Number(avg.toFixed(3)),
        obp: Number(obp.toFixed(3)),
        slg: Number(slg.toFixed(3)),
        ops: Number((obp + slg).toFixed(3)),
      };
    });
  }, [gameLog]);

  if (data.length < 2) return null;

  const activeConfig = STAT_CONFIG.find((s) => s.key === activeStat)!;

  return (
    <div className="space-y-3">
      {/* Stat toggle chips */}
      <div className="flex gap-2 flex-wrap">
        {STAT_CONFIG.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveStat(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 select-none ${
              activeStat === s.key
                ? "border-transparent text-white shadow-md"
                : "bg-muted/30 border-border/50 text-muted-foreground"
            }`}
            style={activeStat === s.key ? { backgroundColor: s.color } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#888" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#888" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              domain={[0, "auto"]}
              tickFormatter={(v: number) => v.toFixed(3)}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a1a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#888", fontSize: 11 }}
              formatter={(value) => [Number(value).toFixed(3), activeConfig.label]}
            />
            <Line
              type="monotone"
              dataKey={activeStat}
              stroke={activeConfig.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: activeConfig.color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: activeConfig.color, strokeWidth: 2, stroke: "#fff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Current value */}
      <div className="text-center">
        <span className="text-2xl font-extrabold tabular-nums" style={{ color: activeConfig.color }}>
          {data[data.length - 1]?.[activeStat]?.toFixed(3)}
        </span>
        <span className="text-xs text-muted-foreground ml-2">current {activeConfig.label}</span>
      </div>
    </div>
  );
}
