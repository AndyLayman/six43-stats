"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fullName } from "@/lib/player-name";
import { isAtBat, isHit, formatAvg } from "@/lib/stats/calculations";
import { getResultColor } from "@/lib/scoring/scorebook";
import type { Player, PlateAppearance, PlateAppearanceResult, Game } from "@/lib/scoring/types";
import { NavArrowLeft, ShareAndroid } from "iconoir-react";

// ── Rarity tiers based on game performance ──

type Rarity = "common" | "rare" | "epic" | "legendary";

function getRarity(stats: PlayerGameStats): Rarity {
  if (stats.homeRuns > 0 || stats.hits >= 4 || (stats.atBats > 0 && stats.avg >= 1.0)) return "legendary";
  if (stats.extraBaseHits >= 2 || stats.hits >= 3 || stats.rbis >= 3) return "epic";
  if (stats.hits >= 2 || stats.rbis >= 2 || stats.stolenBases >= 2) return "rare";
  return "common";
}

const RARITY_CONFIG: Record<Rarity, { label: string; colors: string[]; glow: string }> = {
  common: {
    label: "Common",
    colors: ["#a1a1aa", "#d4d4d8", "#a1a1aa"],
    glow: "rgba(161,161,170,0.25)",
  },
  rare: {
    label: "Rare",
    colors: ["#3b82f6", "#67e8f9", "#3b82f6"],
    glow: "rgba(59,130,246,0.35)",
  },
  epic: {
    label: "Epic",
    colors: ["#a855f7", "#f0abfc", "#a855f7"],
    glow: "rgba(168,85,247,0.4)",
  },
  legendary: {
    label: "Legendary",
    colors: ["#f59e0b", "#fde68a", "#f97316"],
    glow: "rgba(245,158,11,0.5)",
  },
};

interface SprayHit {
  x: number;
  y: number;
  result: PlateAppearanceResult;
}

interface PlayerGameStats {
  playerId: number;
  player: Player;
  plateAppearances: number;
  atBats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbis: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
  avg: number;
  extraBaseHits: number;
  results: string[];
  sprayHits: SprayHit[];
}

function computePlayerGameStats(player: Player, pas: PlateAppearance[]): PlayerGameStats {
  const playerPAs = pas.filter((pa) => pa.player_id === player.id && pa.team === "us");
  const atBats = playerPAs.filter((pa) => isAtBat(pa.result)).length;
  const hits = playerPAs.filter((pa) => isHit(pa.result)).length;
  const doubles = playerPAs.filter((pa) => pa.result === "2B").length;
  const triples = playerPAs.filter((pa) => pa.result === "3B").length;
  const homeRuns = playerPAs.filter((pa) => pa.result === "HR").length;
  const walks = playerPAs.filter((pa) => pa.result === "BB").length;
  const strikeouts = playerPAs.filter((pa) => pa.result === "SO").length;
  const rbis = playerPAs.reduce((sum, pa) => sum + pa.rbis, 0);
  const stolenBases = playerPAs.reduce((sum, pa) => sum + pa.stolen_bases, 0);

  const sprayHits: SprayHit[] = playerPAs
    .filter((pa) => pa.spray_x != null && pa.spray_y != null)
    .map((pa) => ({ x: pa.spray_x!, y: pa.spray_y!, result: pa.result }));

  return {
    playerId: player.id,
    player,
    plateAppearances: playerPAs.length,
    atBats,
    hits,
    singles: playerPAs.filter((pa) => pa.result === "1B").length,
    doubles,
    triples,
    homeRuns,
    rbis,
    walks,
    strikeouts,
    stolenBases,
    avg: atBats === 0 ? 0 : hits / atBats,
    extraBaseHits: doubles + triples + homeRuns,
    results: playerPAs.map((pa) => pa.result),
    sprayHits,
  };
}

// ── Mini Spray Chart (non-interactive, for the card) ──

function MiniSprayChart({ hits, glowColor }: { hits: SprayHit[]; glowColor: string }) {
  return (
    <svg viewBox="0 100 300 200" className="w-full h-full">
      {/* Foul lines */}
      <line x1="150" y1="280" x2="16" y2="146" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="150" y1="280" x2="284" y2="146" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      {/* Fence arc */}
      <path d="M 16 146 A 160 160 0 0 1 284 146" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      {/* Infield diamond */}
      <path d="M 150 280 L 80 210 L 150 140 L 220 210 Z" fill="currentColor" opacity="0.05" />
      <line x1="150" y1="280" x2="80" y2="210" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="80" y1="210" x2="150" y2="140" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="150" y1="140" x2="220" y2="210" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="220" y1="210" x2="150" y2="280" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      {/* Hit markers */}
      {hits.map((h, i) => (
        <g key={i}>
          <circle cx={h.x} cy={h.y} r="8" fill={getResultColor(h.result)} opacity="0.2" />
          <circle cx={h.x} cy={h.y} r="5" fill={getResultColor(h.result)} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </g>
      ))}
      {/* Home plate */}
      <rect x="145" y="275" width="10" height="10" fill="currentColor" opacity="0.4" transform="rotate(45 150 280)" />
    </svg>
  );
}

// ── 3D Rotatable Card ──

function PlayerCard({ stats, game, opponentName, gameDate }: {
  stats: PlayerGameStats;
  game: Game;
  opponentName: string;
  gameDate: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef({ x: 0, y: 0 }); // cumulative rotation
  const velRef = useRef({ x: 0, y: 0 }); // velocity for momentum
  const dragRef = useRef<{ startX: number; startY: number; startRotX: number; startRotY: number; lastX: number; lastY: number; lastTime: number } | null>(null);
  const animRef = useRef<number>(0);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const rarity = getRarity(stats);
  const config = RARITY_CONFIG[rarity];

  // Momentum animation loop
  useEffect(() => {
    let running = true;
    function tick() {
      if (!running) return;
      if (!dragRef.current && (Math.abs(velRef.current.x) > 0.05 || Math.abs(velRef.current.y) > 0.05)) {
        velRef.current.x *= 0.96;
        velRef.current.y *= 0.96;
        rotRef.current.x += velRef.current.x;
        rotRef.current.y += velRef.current.y;
        setRot({ ...rotRef.current });
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (!containerRef.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    velRef.current = { x: 0, y: 0 };
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRotX: rotRef.current.x,
      startRotY: rotRef.current.y,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: Date.now(),
    };
    setIsDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const now = Date.now();
    const dt = Math.max(now - dragRef.current.lastTime, 1);
    velRef.current = {
      x: ((dragRef.current.lastY - e.clientY) / dt) * -8,
      y: ((e.clientX - dragRef.current.lastX) / dt) * 8,
    };
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    dragRef.current.lastTime = now;
    rotRef.current = {
      x: dragRef.current.startRotX + dy * -0.5,
      y: dragRef.current.startRotY + dx * 0.5,
    };
    setRot({ ...rotRef.current });
  }

  function onPointerUp() {
    dragRef.current = null;
    setIsDragging(false);
  }

  const isWin = game.our_score > game.opponent_score;
  const scoreLine = `${game.our_score}-${game.opponent_score}`;
  const gradientStr = `linear-gradient(135deg, ${config.colors.join(", ")})`;

  // Foil effect driven by rotation
  const foilAngle = 135 + (rot.y % 360) * 0.5;
  const shimmerAngle = 115 + (rot.y % 360) * 0.7;

  // Card thickness in px
  const DEPTH = 8;
  const halfDepth = DEPTH / 2;
  const edgeColor = config.colors[0];

  const cardFaceStyle: React.CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: "1rem",
    overflow: "hidden",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={containerRef}
        style={{ perspective: "1200px", width: 280, height: 420 }}
        className="cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
            transition: isDragging ? "none" : "transform 0.05s linear",
          }}
        >
          {/* ═══ FRONT FACE ═══ */}
          <div
            style={{
              ...cardFaceStyle,
              transform: `translateZ(${halfDepth}px)`,
              boxShadow: `0 0 ${isDragging ? 35 : 15}px ${config.glow}, 0 25px 50px rgba(0,0,0,0.5)`,
            }}
          >
            {/* Dark background */}
            <div className="absolute inset-0 bg-[#0a0a0a]" />

            {/* Holographic foil that shifts with rotation */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: `linear-gradient(${foilAngle}deg, transparent 20%, rgba(255,255,255,0.03) 35%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.03) 65%, transparent 80%)`,
              }}
            />

            {/* Rainbow shimmer */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: `linear-gradient(${shimmerAngle}deg,
                  rgba(255,0,0,0.06), rgba(255,165,0,0.06), rgba(255,255,0,0.06),
                  rgba(0,255,0,0.06), rgba(0,127,255,0.06), rgba(128,0,255,0.06))`,
                opacity: isDragging ? 0.8 : 0.3,
              }}
            />

            {/* Top / bottom borders */}
            <div className="absolute top-0 left-0 right-0 h-1 z-20" style={{ background: gradientStr }} />
            <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ background: gradientStr }} />

            {/* Front card content */}
            <div className="relative z-20 flex flex-col h-full p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ backgroundImage: gradientStr, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {config.label}
                </span>
                <span className="text-[10px] text-zinc-500 tabular-nums">{gameDate}</span>
              </div>

              {/* Big number + spray chart */}
              <div className="flex items-center gap-2 mb-2">
                <div className="shrink-0 flex items-center justify-center w-24 h-24">
                  <span
                    className="text-7xl font-black leading-none"
                    style={{
                      backgroundImage: gradientStr,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: `drop-shadow(0 0 12px ${config.glow})`,
                    }}
                  >
                    {stats.player.number}
                  </span>
                </div>
                <div className="flex-1 h-24 text-zinc-300">
                  {stats.sprayHits.length > 0 ? (
                    <MiniSprayChart hits={stats.sprayHits} glowColor={config.glow} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[10px] text-zinc-600 uppercase tracking-wider">
                      No spray data
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="text-center mb-0.5">
                <div className="text-xl font-black tracking-tight text-white leading-tight">{fullName(stats.player)}</div>
              </div>

              {/* Matchup + score */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-[11px] text-zinc-400">vs {opponentName}</span>
                <span className={`text-[11px] font-bold ${isWin ? "text-emerald-400" : game.our_score === game.opponent_score ? "text-zinc-400" : "text-red-400"}`}>
                  {isWin ? "W" : game.our_score === game.opponent_score ? "T" : "L"} {scoreLine}
                </span>
              </div>

              {/* Primary stats */}
              <div className="grid grid-cols-4 gap-1 mb-2">
                <StatBox label="H" value={stats.hits} max={stats.atBats} highlight={stats.hits >= 2} config={config} />
                <StatBox label="RBI" value={stats.rbis} highlight={stats.rbis >= 2} config={config} />
                <StatBox label="BB" value={stats.walks} config={config} />
                <StatBox label="AVG" value={stats.atBats > 0 ? formatAvg(stats.avg) : "-"} highlight={stats.avg >= 0.5 && stats.atBats > 0} config={config} />
              </div>

              {/* Secondary stats */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                <StatBox label="2B" value={stats.doubles} highlight={stats.doubles > 0} config={config} small />
                <StatBox label="3B" value={stats.triples} highlight={stats.triples > 0} config={config} small />
                <StatBox label="HR" value={stats.homeRuns} highlight={stats.homeRuns > 0} config={config} small />
                <StatBox label="SB" value={stats.stolenBases} highlight={stats.stolenBases > 0} config={config} small />
              </div>

              {/* At-bat results timeline */}
              <div className="mt-auto">
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">At-Bats</div>
                <div className="flex gap-1 flex-wrap">
                  {stats.results.map((r, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isHit(r)
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : r === "BB" || r === "HBP"
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                          : r === "SO"
                          ? "bg-red-500/15 text-red-400 border border-red-500/20"
                          : "bg-zinc-800/80 text-zinc-500 border border-zinc-700/50"
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                  {stats.results.length === 0 && (
                    <span className="text-[10px] text-zinc-600">No plate appearances</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ EDGE STRIPS (card thickness) ═══ */}
          {/* Right edge */}
          <div style={{
            position: "absolute", width: `${DEPTH}px`, height: "100%",
            right: 0, top: 0,
            background: `linear-gradient(180deg, ${edgeColor}22, ${edgeColor}44, ${edgeColor}22)`,
            transform: `rotateY(90deg) translateZ(${280 - halfDepth}px)`,
            transformOrigin: "right center",
            backfaceVisibility: "hidden" as const,
          }} />
          {/* Left edge */}
          <div style={{
            position: "absolute", width: `${DEPTH}px`, height: "100%",
            left: 0, top: 0,
            background: `linear-gradient(180deg, ${edgeColor}22, ${edgeColor}44, ${edgeColor}22)`,
            transform: `rotateY(-90deg) translateZ(${halfDepth}px)`,
            transformOrigin: "left center",
            backfaceVisibility: "hidden" as const,
          }} />
          {/* Top edge */}
          <div style={{
            position: "absolute", width: "100%", height: `${DEPTH}px`,
            left: 0, top: 0,
            background: `linear-gradient(90deg, ${edgeColor}22, ${edgeColor}44, ${edgeColor}22)`,
            transform: `rotateX(90deg) translateZ(${halfDepth}px)`,
            transformOrigin: "top center",
            backfaceVisibility: "hidden" as const,
          }} />
          {/* Bottom edge */}
          <div style={{
            position: "absolute", width: "100%", height: `${DEPTH}px`,
            left: 0, bottom: 0,
            background: `linear-gradient(90deg, ${edgeColor}22, ${edgeColor}44, ${edgeColor}22)`,
            transform: `rotateX(-90deg) translateZ(${420 - halfDepth}px)`,
            transformOrigin: "bottom center",
            backfaceVisibility: "hidden" as const,
          }} />

          {/* ═══ BACK FACE ═══ */}
          <div
            style={{
              ...cardFaceStyle,
              transform: `rotateY(180deg) translateZ(${halfDepth}px)`,
              boxShadow: `0 0 ${isDragging ? 35 : 15}px ${config.glow}, 0 25px 50px rgba(0,0,0,0.5)`,
            }}
          >
            <div className="absolute inset-0 bg-[#0a0a0a]" />

            {/* Subtle pattern background */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)`,
              color: config.colors[1],
            }} />

            {/* Holographic foil on back */}
            <div className="absolute inset-0 pointer-events-none z-10" style={{
              background: `linear-gradient(${foilAngle + 180}deg, transparent 20%, rgba(255,255,255,0.03) 35%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.03) 65%, transparent 80%)`,
            }} />

            {/* Top / bottom borders */}
            <div className="absolute top-0 left-0 right-0 h-1 z-20" style={{ background: gradientStr }} />
            <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ background: gradientStr }} />

            {/* Back content */}
            <div className="relative z-20 flex flex-col items-center justify-center h-full p-6">
              {/* Big centered spray chart */}
              <div className="w-52 h-52 text-zinc-300 mb-4">
                {stats.sprayHits.length > 0 ? (
                  <MiniSprayChart hits={stats.sprayHits} glowColor={config.glow} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <svg viewBox="0 0 80 80" className="w-20 h-20 opacity-10">
                      <path d="M 40 70 L 10 40 L 40 10 L 70 40 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                      <rect x="37" y="67" width="6" height="6" fill="currentColor" transform="rotate(45 40 70)" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Name + number */}
              <div
                className="text-5xl font-black mb-1"
                style={{
                  backgroundImage: gradientStr,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 0 8px ${config.glow})`,
                }}
              >
                #{stats.player.number}
              </div>
              <div className="text-lg font-black text-white mb-3">{fullName(stats.player)}</div>

              {/* Game summary line */}
              <div className="text-[11px] text-zinc-500 mb-4">
                vs {opponentName} &middot; {gameDate}
              </div>

              {/* Condensed box score */}
              <div className="w-full grid grid-cols-3 gap-y-2 text-center">
                <div>
                  <div className="text-2xl font-black text-white">{stats.hits}<span className="text-zinc-600 text-sm">/{stats.atBats}</span></div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Hits</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{stats.rbis}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">RBI</div>
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ backgroundImage: gradientStr, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {stats.atBats > 0 ? formatAvg(stats.avg) : "-"}
                  </div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">AVG</div>
                </div>
              </div>

              {/* Rarity badge */}
              <div className="mt-auto pt-4">
                <span
                  className="text-[10px] font-black uppercase tracking-[0.25em] px-3 py-1 rounded-full border"
                  style={{
                    backgroundImage: gradientStr,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    borderColor: config.colors[0] + "40",
                  }}
                >
                  {config.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, max, highlight, config, small }: {
  label: string;
  value: string | number;
  max?: number;
  highlight?: boolean;
  config: typeof RARITY_CONFIG[Rarity];
  small?: boolean;
}) {
  return (
    <div className="text-center">
      <div className={`${small ? "text-sm" : "text-xl"} font-black tabular-nums leading-none`} style={highlight ? { backgroundImage: `linear-gradient(135deg, ${config.colors.join(", ")})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : { color: "#d4d4d8" }}>
        {value}{max != null && !small ? <span className="text-zinc-600 text-xs font-bold">/{max}</span> : null}
      </div>
      <div className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

// ── Main Page ──

export default function PlayerCardsPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [gameRes, lineupRes, playersRes, pasRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("game_lineup").select("*").eq("game_id", gameId).order("batting_order"),
        supabase.from("players").select("*"),
        supabase.from("plate_appearances").select("*").eq("game_id", gameId).eq("team", "us").order("created_at"),
      ]);

      if (!gameRes.data) { setLoading(false); return; }

      const game = gameRes.data as Game;
      const players: Player[] = playersRes.data ?? [];
      const lineup = lineupRes.data ?? [];
      const pas: PlateAppearance[] = pasRes.data ?? [];

      const lineupPlayers = lineup
        .map((l: { player_id: number }) => players.find((p) => p.id === l.player_id))
        .filter((p): p is Player => !!p);

      const stats = lineupPlayers.map((p) => computePlayerGameStats(p, pas));

      setGame(game);
      setPlayerStats(stats);
      setLoading(false);
    }
    load();
  }, [gameId]);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Player Cards - ${game?.opponent ?? "Game"}`, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground animate-pulse">Loading cards...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

  const gameDate = new Date(game.date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isWin = game.our_score > game.opponent_score;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href={`/games/${gameId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-1">
            <NavArrowLeft width={16} height={16} />
            Game Recap
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Player Cards</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isWin ? "W" : game.our_score === game.opponent_score ? "T" : "L"} {game.our_score}-{game.opponent_score} vs {game.opponent} &middot; {gameDate}
          </p>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <ShareAndroid width={16} height={16} />
          Share
        </button>
      </div>

      {/* Cards Grid */}
      <div className="flex flex-wrap justify-center gap-8 pb-12">
        {playerStats.map((stats) => (
          <PlayerCard
            key={stats.playerId}
            stats={stats}
            game={game}
            opponentName={game.opponent}
            gameDate={gameDate}
          />
        ))}
      </div>
    </div>
  );
}
