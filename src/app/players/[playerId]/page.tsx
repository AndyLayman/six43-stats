"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAvg } from "@/lib/stats/calculations";
import { SprayChart } from "@/components/scoring/SprayChart";
import { ProgressionChart } from "@/components/progression-chart";
import type { Player, PlateAppearance, PlateAppearanceResult, BattingStats, FieldingStats, HitType, ChainAward } from "@/lib/scoring/types";
import { fullName } from "@/lib/player-name";
import { StatTip } from "@/components/stat-tip";
import { NavArrowLeft } from "iconoir-react";

type SprayFilter = "both" | "hits" | "outs";

export default function PlayerDetailPage() {
  const params = useParams();
  const playerId = Number(params.playerId);
  const [player, setPlayer] = useState<Player | null>(null);
  const [battingStats, setBattingStats] = useState<BattingStats | null>(null);
  const [fieldingStats, setFieldingStats] = useState<FieldingStats | null>(null);
  const [allPAs, setAllPAs] = useState<PlateAppearance[]>([]);
  const [gameLog, setGameLog] = useState<{ game_id: string; date: string; opponent: string; appearances: PlateAppearance[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sprayFilter, setSprayFilter] = useState<SprayFilter>("both");
  const [heatMode, setHeatMode] = useState(false);
  const [chainAwards, setChainAwards] = useState<ChainAward[]>([]);

  useEffect(() => {
    async function load() {
      const [playerRes, battingRes, fieldingRes, pasRes, gamesRes, awardsRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", playerId).single(),
        supabase.from("batting_stats_season").select("*").eq("player_id", playerId).single(),
        supabase.from("fielding_stats_season").select("*").eq("player_id", playerId).single(),
        supabase.from("plate_appearances").select("*").eq("player_id", playerId).order("created_at"),
        supabase.from("games").select("*").eq("status", "final").order("date", { ascending: false }),
        supabase.from("chain_awards").select("*").eq("player_id", playerId).order("date", { ascending: false }),
      ]);

      setPlayer(playerRes.data);
      setBattingStats(battingRes.data);
      setFieldingStats(fieldingRes.data);
      setChainAwards(awardsRes.data ?? []);

      const games = gamesRes.data ?? [];
      const pas: PlateAppearance[] = pasRes.data ?? [];
      setAllPAs(pas);
      const log = games
        .filter((g) => pas.some((pa) => pa.game_id === g.id))
        .map((g) => ({
          game_id: g.id,
          date: g.date,
          opponent: g.opponent,
          appearances: pas.filter((pa) => pa.game_id === g.id),
        }));
      setGameLog(log);
      setLoading(false);
    }
    load();
  }, [playerId]);

  const cumulativeAvg = useMemo(() => {
    if (gameLog.length === 0) return new Map<string, number>();
    const sorted = [...gameLog].sort((a, b) => a.date.localeCompare(b.date));
    let cumHits = 0;
    let cumAB = 0;
    const result = new Map<string, number>();
    for (const g of sorted) {
      cumAB += g.appearances.filter(pa => pa.is_at_bat).length;
      cumHits += g.appearances.filter(pa => pa.is_hit).length;
      result.set(g.game_id, cumAB > 0 ? cumHits / cumAB : 0);
    }
    return result;
  }, [gameLog]);

  const avgTrend = useMemo(() => {
    if (gameLog.length === 0) return [] as number[];
    const sorted = [...gameLog].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map(g => cumulativeAvg.get(g.game_id) ?? 0);
  }, [gameLog, cumulativeAvg]);

  const milestones = useMemo(() => {
    if (!battingStats || Number(battingStats.at_bats) === 0) return [];
    type Tier = "bronze" | "silver" | "gold";
    const DEFS: { id: string; label: string; field: keyof BattingStats; target: number; order: number; tier: Tier }[] = [
      { id: "games-10", label: "10 Games", field: "games", target: 10, order: 0, tier: "bronze" },
      { id: "games-25", label: "25 Games", field: "games", target: 25, order: 1, tier: "silver" },
      { id: "hits-10", label: "10 Hits", field: "hits", target: 10, order: 2, tier: "bronze" },
      { id: "hits-25", label: "25 Hits", field: "hits", target: 25, order: 3, tier: "silver" },
      { id: "hits-50", label: "50 Hits", field: "hits", target: 50, order: 4, tier: "gold" },
      { id: "hr-1", label: "First Homer", field: "home_runs", target: 1, order: 5, tier: "silver" },
      { id: "hr-5", label: "5 Home Runs", field: "home_runs", target: 5, order: 6, tier: "gold" },
      { id: "rbi-10", label: "10 RBI", field: "rbis", target: 10, order: 7, tier: "bronze" },
      { id: "rbi-25", label: "25 RBI", field: "rbis", target: 25, order: 8, tier: "silver" },
      { id: "sb-5", label: "5 Stolen Bases", field: "stolen_bases", target: 5, order: 9, tier: "bronze" },
      { id: "sb-10", label: "10 Stolen Bases", field: "stolen_bases", target: 10, order: 10, tier: "silver" },
    ];
    const results = DEFS.map((def) => {
      const current = Number(battingStats[def.field]);
      const completed = current >= def.target;
      const pct = Math.min((current / def.target) * 100, 100);
      return { ...def, current, completed, pct };
    });
    const fields = [...new Set(DEFS.map(d => d.field))];
    const visible: typeof results = [];
    for (const field of fields) {
      const fieldMs = results.filter(m => m.field === field);
      visible.push(...fieldMs.filter(m => m.completed));
      const next = fieldMs.find(m => !m.completed);
      if (next) visible.push(next);
    }
    visible.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      if (a.completed) return a.order - b.order;
      return b.pct - a.pct;
    });
    return visible;
  }, [battingStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!player) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Player not found</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
        <NavArrowLeft width={16} height={16} />
        All Players
      </Link>
      <div className="flex items-center gap-4">
        {player.photo_file ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={supabase.storage.from("media").getPublicUrl(`player-${player.id}-photo`).data.publicUrl}
            alt={fullName(player)}
            className="h-16 w-16 rounded-full object-cover border border-primary/30"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 font-bold text-2xl border border-primary/30 text-gradient-bright">
            {player.number}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gradient">{fullName(player)}</h1>
          <p className="text-sm text-muted-foreground">
            {player.bats || player.throws
              ? `Bats: ${player.bats ?? "—"}, Throws: ${player.throws ?? "—"}`
              : `#${player.number}`}
          </p>
        </div>
      </div>

      {/* Season stat highlights */}
      {battingStats && Number(battingStats.at_bats) > 0 && (
        <div className="grid gap-3 grid-cols-3 md:grid-cols-6 stagger-children">
          {[
            { label: "AVG", value: formatAvg(Number(battingStats.avg)) },
            { label: "OBP", value: formatAvg(Number(battingStats.obp)) },
            { label: "SLG", value: formatAvg(Number(battingStats.slg)) },
            { label: "OPS", value: formatAvg(Number(battingStats.ops)) },
            { label: "HR", value: String(battingStats.home_runs) },
            { label: "RBI", value: String(battingStats.rbis) },
          ].map((s) => (
            <Card key={s.label} className="glass gradient-border card-hover">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-extrabold tabular-nums text-gradient-bright">{s.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium"><StatTip label={s.label} /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chain Awards */}
      {chainAwards.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-gradient">Chain Awards</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-2">
              {chainAwards.map((award) => (
                <div
                  key={award.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${
                    award.award_type === "game_chain"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-blue-500/10 border-blue-500/30"
                  }`}
                >
                  <span className="text-xl">
                    {award.award_type === "game_chain" ? "🏆" : "💪"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${
                      award.award_type === "game_chain" ? "text-amber-400" : "text-blue-400"
                    }`}>
                      {award.award_type === "game_chain" ? "Game Chain" : "Hard Worker"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(award.date + "T00:00:00").toLocaleDateString()} · {award.source_type === "game" ? "Game" : "Practice"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-gradient">Milestones</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {milestones.map((m) => {
                const R = 16;
                const C = 2 * Math.PI * R;
                const dash = (m.pct / 100) * C;
                return (
                  <div key={m.id} className="flex flex-col items-center text-center gap-1.5 py-2">
                    {m.completed ? (
                      <HexBadge tier={m.tier} />
                    ) : (
                      <div className="relative w-12 h-12">
                        <svg viewBox="0 0 40 40" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" strokeWidth="3" className="text-border/20" />
                          <circle
                            cx="20" cy="20" r={R} fill="none"
                            stroke="currentColor" strokeWidth="3"
                            strokeDasharray={`${dash} ${C}`}
                            strokeLinecap="round"
                            className={m.pct >= 75 ? "text-primary" : m.pct >= 40 ? "text-primary/60" : "text-muted-foreground/40"}
                            style={{ transition: "stroke-dasharray 0.6s ease" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-extrabold tabular-nums leading-none text-white">{m.current}</span>
                          <span className="text-[7px] text-white/50">/{m.target}</span>
                        </div>
                      </div>
                    )}
                    <div className={`text-[10px] font-bold leading-tight ${m.completed ? "text-foreground" : "text-muted-foreground"}`}>
                      {m.label}
                    </div>
                    {!m.completed && (
                      <div className="text-[9px] text-muted-foreground/40 tabular-nums">{Math.round(m.pct)}%</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spray Chart */}
      {(() => {
        const sprayPAs = allPAs.filter((pa) => pa.spray_x != null && pa.spray_y != null);
        if (sprayPAs.length === 0) return null;

        const filtered = sprayPAs.filter((pa) => {
          if (sprayFilter === "hits") return pa.is_hit;
          if (sprayFilter === "outs") return !pa.is_hit;
          return true;
        });

        const ghostMarkers = filtered.map((pa) => ({
          x: pa.spray_x!,
          y: pa.spray_y!,
          result: pa.result as PlateAppearanceResult,
          hitType: pa.hit_type as HitType | null,
        }));

        return (
          <Card className="glass border-border/50">
            <CardHeader className="px-3 sm:px-6 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-gradient">Spray Chart</CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHeatMode(!heatMode)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    heatMode
                      ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                      : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Heat
                </button>
                <div className="flex rounded-lg overflow-hidden border border-border/50">
                  {([
                    { value: "both", label: "Both" },
                    { value: "hits", label: "Hits" },
                    { value: "outs", label: "Outs" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSprayFilter(opt.value)}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        sprayFilter === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-1 pt-1 pb-3">
              <div className="max-w-md mx-auto">
                <SprayChart ghostMarkers={ghostMarkers} interactive={false} heatMode={heatMode} />
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 px-3">
                {[
                  { label: "1B", pat: "pat-stripe" },
                  { label: "2B", pat: "pat-dot" },
                  { label: "3B", pat: "pat-cross" },
                  { label: "HR", pat: "solid" },
                  { label: "Out", pat: "hollow" },
                  { label: "Error", pat: "pat-hz" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <svg width="12" height="12" className="inline-block">
                      <defs>
                        <pattern id={`leg-stripe`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.5" height="4" fill="#E9D7B4" /></pattern>
                        <pattern id={`leg-dot`} width="3.5" height="3.5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.9" fill="#E9D7B4" /><circle cx="2.75" cy="2.75" r="0.9" fill="#E9D7B4" /></pattern>
                        <pattern id={`leg-cross`} width="4" height="4" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="4" y2="4" stroke="#E9D7B4" strokeWidth="1.2" /><line x1="4" y1="0" x2="0" y2="4" stroke="#E9D7B4" strokeWidth="1.2" /></pattern>
                        <pattern id={`leg-hz`} width="3" height="3" patternUnits="userSpaceOnUse"><line x1="0" y1="1.5" x2="3" y2="1.5" stroke="#E9D7B4" strokeWidth="1" /></pattern>
                      </defs>
                      <circle
                        cx="6" cy="6" r="5"
                        fill={item.pat === "solid" ? "#E9D7B4" : item.pat === "hollow" ? "none" : `url(#leg-${item.pat.replace("pat-", "")})`}
                        stroke="#E9D7B4"
                        strokeWidth={item.pat === "hollow" ? 1.5 : item.pat === "solid" ? 0 : 1}
                      />
                    </svg>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Tabs defaultValue="batting">
        <TabsList className="w-full sm:w-auto bg-muted/50">
          <TabsTrigger value="batting" className="flex-1 sm:flex-none">Batting</TabsTrigger>
          <TabsTrigger value="progress" className="flex-1 sm:flex-none">Progress</TabsTrigger>
          <TabsTrigger value="fielding" className="flex-1 sm:flex-none">Fielding</TabsTrigger>
          <TabsTrigger value="gamelog" className="flex-1 sm:flex-none">Game Log</TabsTrigger>
        </TabsList>

        <TabsContent value="batting">
          {battingStats && Number(battingStats.at_bats) > 0 ? (
            <Card className="glass border-border/50">
              <CardHeader className="px-3 sm:px-6">
                <CardTitle className="text-gradient">Season Batting Stats</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {/* Mobile: stat grid */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:hidden">
                  {[
                    { label: "G", value: battingStats.games },
                    { label: "AB", value: battingStats.at_bats },
                    { label: "H", value: battingStats.hits },
                    { label: "2B", value: battingStats.doubles },
                    { label: "3B", value: battingStats.triples },
                    { label: "HR", value: battingStats.home_runs },
                    { label: "RBI", value: battingStats.rbis },
                    { label: "BB", value: battingStats.walks },
                    { label: "SO", value: battingStats.strikeouts },
                    { label: "SB", value: battingStats.stolen_bases },
                    { label: "AVG", value: formatAvg(Number(battingStats.avg)) },
                    { label: "OBP", value: formatAvg(Number(battingStats.obp)) },
                    { label: "SLG", value: formatAvg(Number(battingStats.slg)) },
                    { label: "OPS", value: formatAvg(Number(battingStats.ops)) },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="text-lg font-bold tabular-nums">{s.value}</div>
                      <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider"><StatTip label={s.label} /></div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead><StatTip label="G" /></TableHead>
                        <TableHead><StatTip label="PA" /></TableHead>
                        <TableHead><StatTip label="AB" /></TableHead>
                        <TableHead><StatTip label="H" /></TableHead>
                        <TableHead><StatTip label="2B" /></TableHead>
                        <TableHead><StatTip label="3B" /></TableHead>
                        <TableHead><StatTip label="HR" /></TableHead>
                        <TableHead><StatTip label="RBI" /></TableHead>
                        <TableHead><StatTip label="BB" /></TableHead>
                        <TableHead><StatTip label="SO" /></TableHead>
                        <TableHead><StatTip label="SB" /></TableHead>
                        <TableHead><StatTip label="AVG" /></TableHead>
                        <TableHead><StatTip label="OBP" /></TableHead>
                        <TableHead><StatTip label="SLG" /></TableHead>
                        <TableHead><StatTip label="OPS" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-border/30">
                        <TableCell>{battingStats.games}</TableCell>
                        <TableCell>{battingStats.plate_appearances}</TableCell>
                        <TableCell>{battingStats.at_bats}</TableCell>
                        <TableCell>{battingStats.hits}</TableCell>
                        <TableCell>{battingStats.doubles}</TableCell>
                        <TableCell>{battingStats.triples}</TableCell>
                        <TableCell>{battingStats.home_runs}</TableCell>
                        <TableCell>{battingStats.rbis}</TableCell>
                        <TableCell>{battingStats.walks}</TableCell>
                        <TableCell>{battingStats.strikeouts}</TableCell>
                        <TableCell>{battingStats.stolen_bases}</TableCell>
                        <TableCell className="font-bold text-primary">{formatAvg(Number(battingStats.avg))}</TableCell>
                        <TableCell>{formatAvg(Number(battingStats.obp))}</TableCell>
                        <TableCell>{formatAvg(Number(battingStats.slg))}</TableCell>
                        <TableCell>{formatAvg(Number(battingStats.ops))}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No batting stats yet</p>
          )}
        </TabsContent>

        <TabsContent value="progress">
          {gameLog.length >= 2 ? (
            <Card className="glass border-border/50">
              <CardHeader className="px-3 sm:px-6">
                <CardTitle className="text-gradient">Season Progression</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <ProgressionChart appearances={allPAs} gameLog={gameLog} />
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">Need at least 2 games to show progression</p>
          )}
        </TabsContent>

        <TabsContent value="fielding">
          {fieldingStats && Number(fieldingStats.total_chances) > 0 ? (
            <Card className="glass border-border/50">
              <CardHeader className="px-3 sm:px-6">
                <CardTitle className="text-gradient">Season Fielding Stats</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-3 gap-3 sm:hidden">
                  {[
                    { label: "G", value: fieldingStats.games },
                    { label: "PO", value: fieldingStats.putouts },
                    { label: "A", value: fieldingStats.assists },
                    { label: "E", value: fieldingStats.errors },
                    { label: "TC", value: fieldingStats.total_chances },
                    { label: "FLD%", value: Number(fieldingStats.fielding_pct).toFixed(3) },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border/30">
                      <div className="text-lg font-bold tabular-nums">{s.value}</div>
                      <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider"><StatTip label={s.label} /></div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead><StatTip label="G" /></TableHead>
                        <TableHead><StatTip label="PO" /></TableHead>
                        <TableHead><StatTip label="A" /></TableHead>
                        <TableHead><StatTip label="E" /></TableHead>
                        <TableHead><StatTip label="TC" /></TableHead>
                        <TableHead><StatTip label="FLD%" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-border/30">
                        <TableCell>{fieldingStats.games}</TableCell>
                        <TableCell>{fieldingStats.putouts}</TableCell>
                        <TableCell>{fieldingStats.assists}</TableCell>
                        <TableCell>{fieldingStats.errors}</TableCell>
                        <TableCell>{fieldingStats.total_chances}</TableCell>
                        <TableCell className="font-bold text-primary">{Number(fieldingStats.fielding_pct).toFixed(3)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No fielding stats yet</p>
          )}
        </TabsContent>

        <TabsContent value="gamelog">
          {gameLog.length > 0 ? (
            <Card className="glass border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-gradient">Game Log</CardTitle>
                {avgTrend.length >= 2 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">AVG</span>
                    <Sparkline data={avgTrend} width={80} height={24} />
                    <span className="text-xs font-bold tabular-nums text-primary">{formatAvg(avgTrend[avgTrend.length - 1])}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Opponent</TableHead>
                      <TableHead>AB</TableHead>
                      <TableHead>H</TableHead>
                      <TableHead>RBI</TableHead>
                      <TableHead>AVG</TableHead>
                      <TableHead>Results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameLog.map((g) => {
                      const ab = g.appearances.filter((pa) => pa.is_at_bat).length;
                      const h = g.appearances.filter((pa) => pa.is_hit).length;
                      const rbi = g.appearances.reduce((sum, pa) => sum + pa.rbis, 0);
                      const runAvg = cumulativeAvg.get(g.game_id);
                      return (
                        <TableRow key={g.game_id} className="border-border/30">
                          <TableCell>
                            <Link href={`/games/${g.game_id}`} className="text-primary hover:underline">
                              {new Date(g.date + "T00:00:00").toLocaleDateString()}
                            </Link>
                          </TableCell>
                          <TableCell>{g.opponent}</TableCell>
                          <TableCell className="tabular-nums">{ab}</TableCell>
                          <TableCell className="tabular-nums">{h}</TableCell>
                          <TableCell className="tabular-nums">{rbi}</TableCell>
                          <TableCell className="tabular-nums font-medium text-primary">{runAvg != null ? formatAvg(runAvg) : "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {g.appearances.map((pa) => pa.result).join(", ")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No game log yet</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Sparkline({ data, width = 60, height = 20 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.1;
  const range = max - min || 0.001;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const lastX = pad + w;
  const lastY = pad + h - ((data[data.length - 1] - min) / range) * h;

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline points={points} fill="none" stroke="#E9D7B4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill="#E9D7B4" />
    </svg>
  );
}

/* ── Hex Badge for milestone achievements ── */

const BADGE_COLORS = {
  bronze: {
    outer: ["#8b6914", "#cd9b3a", "#8b6914"],
    inner: ["#cd7f32", "#e8b862", "#cd7f32"],
    icon: "#7a5518",
    shadow: "rgba(205,127,50,0.25)",
  },
  silver: {
    outer: ["#6b6b6b", "#b0b0b0", "#6b6b6b"],
    inner: ["#a8a8a8", "#dcdcdc", "#a8a8a8"],
    icon: "#707070",
    shadow: "rgba(180,180,180,0.25)",
  },
  gold: {
    outer: ["#9e7a10", "#d4a520", "#9e7a10"],
    inner: ["#daa520", "#ffe44d", "#daa520"],
    icon: "#8b7300",
    shadow: "rgba(255,215,0,0.3)",
  },
} as const;

function hexPath(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function HexBadge({ tier }: { tier: "bronze" | "silver" | "gold" }) {
  const c = BADGE_COLORS[tier];
  const uid = `hb-${tier}`;
  return (
    <svg viewBox="0 0 48 48" width={52} height={52} style={{ filter: `drop-shadow(0 2px 6px ${c.shadow})` }}>
      <defs>
        <linearGradient id={`${uid}-o`} x1="0" y1="0" x2="1" y2="1">
          {c.outer.map((s, i) => <stop key={i} offset={`${(i / (c.outer.length - 1)) * 100}%`} stopColor={s} />)}
        </linearGradient>
        <linearGradient id={`${uid}-i`} x1="0" y1="0" x2="1" y2="1">
          {c.inner.map((s, i) => <stop key={i} offset={`${(i / (c.inner.length - 1)) * 100}%`} stopColor={s} />)}
        </linearGradient>
        {/* Metallic sheen highlight */}
        <linearGradient id={`${uid}-sh`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Outer hex frame */}
      <polygon points={hexPath(24, 24, 22)} fill={`url(#${uid}-o)`} />
      {/* Inner hex body */}
      <polygon points={hexPath(24, 24, 17)} fill={`url(#${uid}-i)`} />
      {/* Metallic sheen on inner */}
      <polygon points={hexPath(24, 24, 17)} fill={`url(#${uid}-sh)`} />
      {/* Trophy icon */}
      <g transform="translate(24, 23)" fill={c.icon}>
        {/* Cup */}
        <path d="M-5.5-6 h11 l-1.5 8 c-0.5 2-1.5 3-4 3.5 c-2.5-0.5-3.5-1.5-4-3.5 z" />
        {/* Handles */}
        <path d="M-5.5-4 c-2.5 0-3 3-2 5 c0.5 0.8 1.5 0.8 2 0" fill="none" stroke={c.icon} strokeWidth="1" />
        <path d="M5.5-4 c2.5 0 3 3 2 5 c-0.5 0.8-1.5 0.8-2 0" fill="none" stroke={c.icon} strokeWidth="1" />
        {/* Stem + base */}
        <rect x="-1.5" y="5.5" width="3" height="2.5" rx="0.5" />
        <rect x="-4" y="8" width="8" height="2" rx="1" />
      </g>
      {/* Edge highlight on outer hex */}
      <polygon points={hexPath(24, 24, 22)} fill="none" stroke="white" strokeWidth="0.5" opacity="0.2" />
    </svg>
  );
}
