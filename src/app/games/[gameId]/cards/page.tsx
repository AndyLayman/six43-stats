"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fullName } from "@/lib/player-name";
import { isAtBat, isHit, formatAvg } from "@/lib/stats/calculations";
import type { Player, PlateAppearance, PlateAppearanceResult, Game } from "@/lib/scoring/types";
import { useAuth } from "@/components/auth-provider";
import { NavArrowLeft, ShareAndroid } from "iconoir-react";

// ── Rarity tiers based on game performance ──

type Rarity = "common" | "rare" | "epic" | "legendary";

function getRarity(stats: PlayerGameStats): Rarity {
  if (stats.homeRuns > 0 || stats.hits >= 3 || (stats.atBats >= 2 && stats.avg >= 1.0)) return "legendary";
  if (stats.extraBaseHits >= 1 || stats.hits >= 2 || stats.rbis >= 2 || (stats.hits >= 1 && stats.stolenBases >= 1)) return "epic";
  if (stats.hits >= 1 || stats.walks >= 1 || stats.rbis >= 1 || stats.stolenBases >= 1) return "rare";
  return "common";
}

const RARITY_CONFIG: Record<Rarity, { label: string; panelColor: string; textOnPanel: string; gradientColors: string; glow: string; numberGradient: string }> = {
  legendary: {
    label: "LEGENDARY",
    panelColor: "#FFE32C",
    textOnPanel: "#111111",
    gradientColors: "rgb(223,204,0), rgb(248,184,46), rgb(201,181,0)",
    glow: "rgba(255,227,44,0.4)",
    numberGradient: "linear-gradient(141deg, rgb(223,204,0) 0%, rgb(248,184,46) 28%, rgb(201,181,0) 72%)",
  },
  epic: {
    label: "EPIC",
    panelColor: "#5A0097",
    textOnPanel: "#F7F7F7",
    gradientColors: "rgb(145,0,223), rgb(248,46,157), rgb(154,0,201)",
    glow: "rgba(90,0,151,0.4)",
    numberGradient: "linear-gradient(149deg, rgb(145,0,223) 0%, rgb(248,46,157) 28%, rgb(154,0,201) 72%)",
  },
  rare: {
    label: "RARE",
    panelColor: "#003097",
    textOnPanel: "#F7F7F7",
    gradientColors: "rgb(55,192,255), rgb(46,90,248), rgb(0,201,194)",
    glow: "rgba(0,48,151,0.4)",
    numberGradient: "linear-gradient(161deg, rgb(55,192,255) 0%, rgb(46,90,248) 28%, rgb(0,201,194) 72%)",
  },
  common: {
    label: "COMMON",
    panelColor: "#8D8D8D",
    textOnPanel: "#F7F7F7",
    gradientColors: "rgb(141,141,141), rgb(200,200,200), rgb(141,141,141)",
    glow: "rgba(141,141,141,0.3)",
    numberGradient: "linear-gradient(141deg, #aaa 0%, #ddd 50%, #aaa 100%)",
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

function getHitSummary(stats: PlayerGameStats): string {
  const parts: string[] = [];
  if (stats.singles > 0) parts.push(`${stats.singles} Single${stats.singles > 1 ? "s" : ""}`);
  if (stats.doubles > 0) parts.push(`${stats.doubles} Double${stats.doubles > 1 ? "s" : ""}`);
  if (stats.triples > 0) parts.push(`${stats.triples} Triple${stats.triples > 1 ? "s" : ""}`);
  if (stats.homeRuns > 0) parts.push(`${stats.homeRuns} HR${stats.homeRuns > 1 ? "s" : ""}`);
  if (stats.walks > 0) parts.push(`${stats.walks} BB`);
  if (parts.length === 0) return "No Hits";
  return parts.join(", ");
}

// ── Team name border text component ──
function TeamBorderText({ teamName, count = 6 }: { teamName: string; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="shrink-0 text-[5px] font-semibold tracking-wider opacity-80 uppercase" style={{ color: "#111", fontFamily: "'Montserrat', sans-serif" }}>
          {teamName}
        </span>
      ))}
    </>
  );
}

// ── Rarity card numbering ──
const RARITY_PRINT_RUN: Record<Rarity, number | null> = {
  legendary: 1,
  epic: 5,
  rare: 25,
  common: null,
};

function generateCardNumber(rarity: Rarity): string | null {
  const total = RARITY_PRINT_RUN[rarity];
  if (total === null) return null;
  if (total === 1) return "1/1";
  const num = Math.floor(Math.random() * total) + 1;
  return `${num}/${total}`;
}

// ── Sparkle particles ──
function Sparkles({ count = 20 }: { count?: number }) {
  const sparkles = useMemo(() =>
    Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      delay: Math.random() * 3,
      duration: 0.8 + Math.random() * 1.2,
    })), [count]);

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animation: `sparkle ${s.duration}s ${s.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Card face matching Figma design ──
function CardFace({ stats, teamName, teamLogo, cardNumber, foilAngle, rotX, rotY }: {
  stats: PlayerGameStats;
  teamName: string;
  teamLogo: string | null;
  cardNumber: string | null;
  foilAngle: number;
  rotX: number;
  rotY: number;
}) {
  const rarity = getRarity(stats);
  const config = RARITY_CONFIG[rarity];
  const fName = stats.player.first_name || "";
  const lName = stats.player.last_name || "";

  // Parallax offsets based on card tilt
  const px = rotY * 0.1;
  const py = rotX * -0.1;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#F7F7F7", fontFamily: "'Montserrat', sans-serif" }}>
      {/* Holographic gradient background */}
      <div className="absolute inset-0" style={{
        backgroundImage: "linear-gradient(117deg, rgb(108,160,227) 5%, rgb(172,163,222) 10%, rgb(133,228,178) 15%, rgb(112,214,221) 20%, rgb(151,172,241) 24%, rgb(217,185,225) 29%, rgb(231,221,213) 33%, rgb(229,203,217) 41%, rgb(228,183,223) 49%, rgb(184,182,233) 56%, rgb(141,182,242) 65%, rgb(178,169,240) 74%, rgb(227,178,232) 80%, rgb(233,221,218) 86%, rgb(129,245,247) 93%, rgb(123,163,244) 99%)",
        opacity: 0.6,
      }} />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"n\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"4\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23n)\" opacity=\"0.08\"/%3E%3C/svg%3E')",
        backgroundSize: "200px 200px",
      }} />

      {/* Holographic logo stamp — tiled logos masked by a moving rainbow gradient */}
      <div className="absolute inset-0 z-[3] pointer-events-none" style={{
        backgroundImage: "url('/six43-mark-white.svg?v=4'), url('/six43-mark-white.svg?v=4')",
        backgroundSize: "22px 22px, 22px 22px",
        backgroundPosition: "0 0, 11px 11px",
        backgroundRepeat: "repeat, repeat",
        opacity: 0.5,
        mixBlendMode: "overlay",
        mask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
        WebkitMask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
      }} />
      {/* Rainbow color wash over the logos — smoothly shifts hue with rotation */}
      <div className="absolute inset-0 z-[4] pointer-events-none" style={{
        background: `linear-gradient(${foilAngle + 45}deg,
          hsla(${(foilAngle * 2) % 360}, 80%, 70%, 0.15),
          hsla(${(foilAngle * 2 + 60) % 360}, 80%, 70%, 0.2),
          hsla(${(foilAngle * 2 + 120) % 360}, 80%, 70%, 0.15),
          hsla(${(foilAngle * 2 + 180) % 360}, 80%, 70%, 0.2),
          hsla(${(foilAngle * 2 + 240) % 360}, 80%, 70%, 0.15),
          hsla(${(foilAngle * 2 + 300) % 360}, 80%, 70%, 0.2))`,
        mixBlendMode: "color",
        mask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
        WebkitMask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
      }} />

      {/* Team name borders — top */}
      <div className="absolute top-0 left-0 right-0 h-[4%] flex items-center justify-center gap-6 overflow-hidden z-10">
        <TeamBorderText teamName={teamName} />
      </div>

      {/* Team name borders — bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[4%] flex items-center justify-center gap-6 overflow-hidden z-10">
        <TeamBorderText teamName={teamName} />
      </div>

      {/* Team name borders — left */}
      <div className="absolute top-0 left-0 bottom-0 w-[4%] flex items-center justify-center z-10">
        <div className="-rotate-90 flex gap-6 items-center whitespace-nowrap">
          <TeamBorderText teamName={teamName} count={8} />
        </div>
      </div>

      {/* Team name borders — right */}
      <div className="absolute top-0 right-0 bottom-0 w-[4%] flex items-center justify-center z-10">
        <div className="rotate-90 flex gap-6 items-center whitespace-nowrap">
          <TeamBorderText teamName={teamName} count={8} />
        </div>
      </div>


      {/* Rarity color block */}
      <div className="absolute inset-[4%] z-[0]" style={{ backgroundColor: config.panelColor }} />

      {/* Giant jersey number — on rarity color, below holo shape */}
      <div className="absolute inset-0 flex items-center justify-center z-[0] pointer-events-none select-none overflow-hidden">
        <span className="leading-none tracking-[-0.13em]" style={{ fontSize: "min(450px, 151cqw)", color: "#111", fontWeight: 700, marginRight: "40px" }}>
          {stats.player.number}
        </span>
      </div>

      {/* Holographic geometric shape — flattened from Figma */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/card-shape.svg"
        alt=""
        className="absolute z-[1] pointer-events-none"
        style={{ top: "15.6%", left: "9.7%", width: "83.7%", height: "52.5%" }}
      />

      {/* Giant jersey number — behind rarity color, visible through holo border */}
      {/* Figma: top=-242 on 1390h = -17.4%, font=1500px on 993w ≈ 151% */}

      {/* Medium jersey number — on top of holo shape */}
      {/* Figma: centered at x≈623 (63%), y=225 on 1390h = 16.2%, font=700px on 993w ≈ 70% */}
      <div className="absolute left-0 right-0 flex justify-center z-[2] pointer-events-none select-none transition-transform duration-75" style={{ top: "22%", paddingLeft: "25%", transform: `translate(${px * -0.5}px, ${py * -0.5}px)` }}>
        <span className="leading-none tracking-[-0.12em]" style={{ fontSize: "min(210px, 70cqw)", color: "#111", fontWeight: 500 }}>
          {stats.player.number}
        </span>
      </div>

      {/* Stats — top left (parallax: shifts with tilt) */}
      <div className="absolute top-[18%] left-[14%] z-20 space-y-[6px] transition-transform duration-75" style={{ transform: `translate(${px * 1.5}px, ${py * 1.5}px)` }}>
        <p className="font-medium text-[#111] leading-none text-[15px]">
          {stats.hits} for {stats.atBats}
        </p>
        <p className="font-medium text-[#111] leading-none text-[15px]">
          {stats.atBats > 0 ? formatAvg(stats.avg) : ".000"}
        </p>
        <p className="font-medium text-[#111] leading-none text-[15px]">
          {getHitSummary(stats)}
        </p>
      </div>

      {/* Card number — top right with gradient */}
      {cardNumber && (
        <div className="absolute top-[7.5%] right-[10%] z-20">
          <span className="font-normal uppercase leading-none text-[10px]" style={{
            backgroundImage: config.numberGradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            {cardNumber}
          </span>
        </div>
      )}

      {/* SIX43 branding — right side vertical */}
      <div className="absolute top-[12%] right-[4%] z-20">
        <span className="rotate-90 inline-block font-bold text-[5px] tracking-[0.44em] whitespace-nowrap" style={{ color: "#111" }}>
          SIX43
        </span>
      </div>

      {/* Six43 logo — bottom left */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/six43-logo.svg" alt="" className="absolute bottom-[10%] left-[10%] z-20 w-[50px] h-[50px]" />

      {/* Colored name panel — bottom right (parallax) */}
      <div className="absolute bottom-0 right-0 w-[48%] h-[28%] z-20 transition-transform duration-75" style={{ backgroundColor: config.panelColor }}>
        {/* SIX43 branding in panel */}
        <p className="absolute top-[10%] right-[8%] font-bold text-[5px] tracking-[0.44em]" style={{ color: config.textOnPanel }}>
          SIX43
        </p>

        {/* Player name */}
        <div className="absolute top-[20%] left-[17%] right-[5%]">
          <p className="font-bold uppercase leading-[0.85] truncate text-[16px]" style={{ color: config.textOnPanel }}>
            {fName}
          </p>
          <p className="font-light uppercase leading-[0.85] mt-[6px] truncate text-[16px]" style={{ color: config.textOnPanel }}>
            {lName}
          </p>
        </div>

        {/* Year */}
        <p className="absolute bottom-[18%] left-[17%] font-bold text-[13px]" style={{ color: config.textOnPanel }}>
          {new Date().getFullYear()}
        </p>

        {/* Rarity label */}
        <p className="absolute bottom-[6%] left-[17%] font-bold text-[5px] tracking-[0.44em] uppercase" style={{ color: config.textOnPanel }}>
          {config.label}
        </p>
      </div>

      {/* Sparkle particles */}
      <Sparkles />
    </div>
  );
}

// ── 3D Rotatable Card ──

function PlayerCard({ stats, teamName, teamLogo, cardNumber }: {
  stats: PlayerGameStats;
  teamName: string;
  teamLogo: string | null;
  cardNumber: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startRotX: number; startRotY: number; lastX: number; lastY: number; lastTime: number } | null>(null);
  const animRef = useRef<number>(0);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [dropPhase, setDropPhase] = useState<"falling" | "impact" | "settle" | "done">("falling");
  const [flashOpacity, setFlashOpacity] = useState(0);
  const rarity = getRarity(stats);
  const config = RARITY_CONFIG[rarity];

  // Drop slam reveal animation
  useEffect(() => {
    // Phase 1: falling (starts off-screen above)
    const t1 = setTimeout(() => setDropPhase("impact"), 400);
    // Phase 2: impact — flash + shockwave
    const t2 = setTimeout(() => {
      setFlashOpacity(0.8);
      setDropPhase("settle");
    }, 420);
    // Phase 3: settle — flash fades, card bounces
    const t3 = setTimeout(() => {
      setFlashOpacity(0);
      setDropPhase("done");
      setRevealed(true);
    }, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  const fName = stats.player.first_name || "";
  const lName = stats.player.last_name || "";

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
      startX: e.clientX, startY: e.clientY,
      startRotX: rotRef.current.x, startRotY: rotRef.current.y,
      lastX: e.clientX, lastY: e.clientY, lastTime: Date.now(),
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

  // Holographic foil shift based on rotation
  const foilAngle = 135 + (rot.y % 360) * 0.5;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={containerRef}
        style={{
          perspective: "1200px",
          width: 300,
          height: 420,
          transform: dropPhase === "falling"
            ? "translateY(-120vh) rotate(-8deg)"
            : dropPhase === "impact"
            ? "translateY(0) rotate(0deg) scale(1.05)"
            : dropPhase === "settle"
            ? "translateY(0) rotate(0deg) scale(0.97)"
            : "translateY(0) rotate(0deg) scale(1)",
          transition: dropPhase === "falling"
            ? "none"
            : dropPhase === "impact"
            ? "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)"
            : dropPhase === "settle"
            ? "transform 0.15s ease-out"
            : "transform 0.2s ease-out",
        }}
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
            transition: isDragging ? "none" : !revealed ? "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" : "transform 0.05s linear",
          }}
        >
          {/* FRONT FACE — outer border wrapper */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "translateZ(3px)",
                            boxShadow: `0 0 ${isDragging ? 35 : 15}px ${config.glow}, 0 25px 50px rgba(0,0,0,0.3)`,
            }}
          >
            {/* Inner content with overflow hidden */}
            <div className="relative w-full h-full overflow-hidden">
            <CardFace stats={stats} teamName={teamName} teamLogo={teamLogo} cardNumber={cardNumber} foilAngle={foilAngle} rotX={rot.x} rotY={rot.y} />

            {/* Holographic foil overlay that shifts with rotation */}
            <div
              className="absolute inset-0 pointer-events-none z-30"
              style={{
                background: `linear-gradient(${foilAngle}deg, transparent 15%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.02) 70%, transparent 85%)`,
                mixBlendMode: "overlay",
              }}
            />

            {/* Rainbow shimmer */}
            <div
              className="absolute inset-0 pointer-events-none z-30"
              style={{
                background: `linear-gradient(${foilAngle + 20}deg,
                  rgba(255,0,0,0.04), rgba(255,165,0,0.04), rgba(255,255,0,0.04),
                  rgba(0,255,0,0.04), rgba(0,127,255,0.04), rgba(128,0,255,0.04))`,
                opacity: isDragging ? 1 : 0.5,
                mixBlendMode: "overlay",
              }}
            />
            </div>{/* end inner overflow wrapper */}
            {/* Full-card holographic foil — covers border area too */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(${foilAngle}deg, transparent 10%, rgba(255,255,255,0.2) 35%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 65%, transparent 90%)`,
                mixBlendMode: "overlay",
              }}
            />
          </div>



          {/* BACK FACE — outer border wrapper */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(3px)",
                            boxShadow: `0 0 ${isDragging ? 35 : 15}px ${config.glow}, 0 25px 50px rgba(0,0,0,0.3)`,
            }}
          >
            <div className="relative w-full h-full overflow-hidden" style={{ background: "#F7F7F7" }}>
            {/* Same holographic background */}
            <div className="absolute inset-0" style={{
              backgroundImage: "linear-gradient(117deg, rgb(108,160,227) 5%, rgb(172,163,222) 10%, rgb(133,228,178) 15%, rgb(112,214,221) 20%, rgb(151,172,241) 24%, rgb(217,185,225) 29%, rgb(231,221,213) 33%, rgb(229,203,217) 41%, rgb(228,183,223) 49%, rgb(184,182,233) 56%, rgb(141,182,242) 65%, rgb(178,169,240) 74%, rgb(227,178,232) 80%, rgb(233,221,218) 86%, rgb(129,245,247) 93%, rgb(123,163,244) 99%)",
              opacity: 0.4,
            }} />

            {/* Six43 logo watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/six43-mark.svg" alt="" className="max-w-none" style={{ width: "125%", height: "125%" }} />
            </div>

            {/* Back content */}
            <div className="relative z-10 flex flex-col h-full p-6 justify-center items-center" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: config.panelColor }}>
                <span className="font-bold text-2xl" style={{ color: config.textOnPanel }}>
                  {stats.player.number}
                </span>
              </div>
              <p className="font-bold text-lg text-white uppercase tracking-wider">{fName}</p>
              <p className="font-light text-lg text-white uppercase tracking-wider">{lName}</p>
              <div className="mt-4 text-center">
                <p className="font-bold text-[10px] tracking-[0.44em] uppercase text-white/70">
                  {config.label}
                </p>
              </div>
            </div>

            {/* Holographic logo pattern on back */}
            <div className="absolute inset-0 z-[15] pointer-events-none" style={{
              backgroundImage: "url('/six43-mark-white.svg?v=4'), url('/six43-mark-white.svg?v=4')",
              backgroundSize: "22px 22px, 22px 22px",
              backgroundPosition: "0 0, 11px 11px",
              backgroundRepeat: "repeat, repeat",
              opacity: 0.5,
              mixBlendMode: "overlay",
              mask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
              WebkitMask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
            }} />
            {/* Rainbow color on back logos */}
            <div className="absolute inset-0 z-[16] pointer-events-none" style={{
              background: `linear-gradient(${foilAngle + 45}deg,
                hsla(${(foilAngle * 2) % 360}, 80%, 70%, 0.15),
                hsla(${(foilAngle * 2 + 60) % 360}, 80%, 70%, 0.2),
                hsla(${(foilAngle * 2 + 120) % 360}, 80%, 70%, 0.15),
                hsla(${(foilAngle * 2 + 180) % 360}, 80%, 70%, 0.2),
                hsla(${(foilAngle * 2 + 240) % 360}, 80%, 70%, 0.15),
                hsla(${(foilAngle * 2 + 300) % 360}, 80%, 70%, 0.2))`,
              mixBlendMode: "color",
              mask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
              WebkitMask: `linear-gradient(${foilAngle}deg, transparent 10%, black 30%, transparent 50%, black 70%, transparent 90%)`,
            }} />

            {/* Foil on back */}
            <div className="absolute inset-0 pointer-events-none z-20" style={{
              background: `linear-gradient(${foilAngle + 180}deg, transparent 15%, rgba(255,255,255,0.1) 50%, transparent 85%)`,
              mixBlendMode: "overlay",
            }} />
            </div>{/* end inner overflow wrapper */}
          </div>
        </div>

        {/* Flash overlay on reveal */}
        <div
          className="absolute inset-0 bg-white rounded-none pointer-events-none"
          style={{
            opacity: flashOpacity,
            transition: "opacity 0.4s ease-out",
            zIndex: 50,
          }}
        />
      </div>
    </div>
  );
}

// ── Main Page ──

export default function PlayerCardsPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { activeTeam } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>([]);
  const [cardNumbers, setCardNumbers] = useState<(string | null)[]>([]);
  const [teamName, setTeamName] = useState("SAN DIEGO PADRES");
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTeam) return;
    async function load() {
      const [gameRes, lineupRes, playersRes, pasRes, teamRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).eq("team_id", activeTeam!.team_id).single(),
        supabase.from("game_lineup").select("*").eq("game_id", gameId).order("batting_order"),
        supabase.from("players").select("*").eq("team_id", activeTeam!.team_id),
        supabase.from("plate_appearances").select("*").eq("game_id", gameId).eq("team", "us").order("created_at"),
        supabase.from("team_settings").select("*").eq("team_id", activeTeam!.team_id).single(),
      ]);

      if (!gameRes.data) { setLoading(false); return; }

      const game = gameRes.data as Game;
      const players: Player[] = playersRes.data ?? [];
      const lineup = lineupRes.data ?? [];
      const pas: PlateAppearance[] = pasRes.data ?? [];

      if (teamRes.data?.name) setTeamName(teamRes.data.name.toUpperCase());
      if (teamRes.data?.logo_svg) setTeamLogo(teamRes.data.logo_svg);

      const lineupPlayers = lineup
        .map((l: { player_id: number }) => players.find((p) => p.id === l.player_id))
        .filter((p): p is Player => !!p);

      const stats = lineupPlayers.map((p) => computePlayerGameStats(p, pas));

      setGame(game);
      setPlayerStats(stats);
      setCardNumbers(stats.map((s) => generateCardNumber(getRarity(s))));
      setLoading(false);
    }
    load();
  }, [gameId, activeTeam]);

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
  const selected = selectedIndex !== null ? playerStats[selectedIndex] : null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

      {selected ? (
        /* ── Single Card View ── */
        <div className="flex flex-col items-center pb-12">
          <div className="flex items-center gap-4 mb-6 w-full max-w-sm">
            <button
              onClick={() => setSelectedIndex((selectedIndex! - 1 + playerStats.length) % playerStats.length)}
              className="p-2 rounded-lg hover:bg-muted/50 active:scale-95 transition-all text-muted-foreground hover:text-foreground"
            >
              <NavArrowLeft width={20} height={20} />
            </button>
            <button
              onClick={() => setSelectedIndex(null)}
              className="flex-1 text-center"
            >
              <div className="text-lg font-extrabold text-foreground">{fullName(selected.player)}</div>
              <div className="text-xs text-muted-foreground">
                #{selected.player.number} &middot; Tap to pick another
              </div>
            </button>
            <button
              onClick={() => setSelectedIndex((selectedIndex! + 1) % playerStats.length)}
              className="p-2 rounded-lg hover:bg-muted/50 active:scale-95 transition-all text-muted-foreground hover:text-foreground"
              style={{ transform: "scaleX(-1)" }}
            >
              <NavArrowLeft width={20} height={20} />
            </button>
          </div>

          <PlayerCard
            key={selected.playerId}
            stats={selected}
            teamName={teamName}
            teamLogo={teamLogo}
            cardNumber={cardNumbers[selectedIndex!] ?? null}
          />
        </div>
      ) : (
        /* ── Player Picker ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-12">
          {playerStats.map((stats, i) => {
            const rarity = getRarity(stats);
            const config = RARITY_CONFIG[rarity];
            return (
              <button
                key={stats.playerId}
                onClick={() => setSelectedIndex(i)}
                className="relative overflow-hidden rounded-xl border border-border/50 p-4 text-left transition-all active:scale-[0.97] hover:border-primary/30 hover:bg-muted/30"
                style={{ boxShadow: `0 0 12px ${config.glow}` }}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(135deg, ${config.gradientColors})` }} />

                <div className="flex items-center gap-3">
                  <div
                    className="text-3xl font-black leading-none shrink-0"
                    style={{
                      backgroundImage: config.numberGradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {stats.player.number}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-foreground truncate">{fullName(stats.player)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {stats.hits}/{stats.atBats} &middot; {stats.rbis} RBI
                    </div>
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ backgroundImage: config.numberGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                    >
                      {config.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
