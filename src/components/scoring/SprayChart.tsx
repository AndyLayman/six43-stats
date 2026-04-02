"use client";

import { useCallback } from "react";
import { getResultColor } from "@/lib/scoring/scorebook";
import type { PlateAppearanceResult, HitType } from "@/lib/scoring/types";

interface SprayChartProps {
  onClick?: (x: number, y: number) => void;
  markers?: { x: number; y: number; result: PlateAppearanceResult }[];
  ghostMarkers?: { x: number; y: number; result: PlateAppearanceResult }[];
  selectedPoint?: { x: number; y: number } | null;
  hitType?: HitType | null;
  interactive?: boolean;
  className?: string;
}

export function SprayChart({
  onClick,
  markers = [],
  ghostMarkers = [],
  selectedPoint,
  hitType,
  interactive = true,
  className = "",
}: SprayChartProps) {
  const getCoords = useCallback((svg: SVGSVGElement, clientX: number, clientY: number) => {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 300;
    const y = ((clientY - rect.top) / rect.height) * 300;
    return { x, y };
  }, []);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!interactive || !onClick) return;
    const { x, y } = getCoords(e.currentTarget, e.clientX, e.clientY);
    onClick(x, y);
  }

  function handleTouch(e: React.TouchEvent<SVGSVGElement>) {
    if (!interactive || !onClick) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    const { x, y } = getCoords(e.currentTarget, touch.clientX, touch.clientY);
    onClick(x, y);
  }

  // Home plate position in SVG coords
  const homeX = 150;
  const homeY = 280;

  return (
    <svg
      viewBox="0 70 300 240"
      className={`w-full select-none ${interactive ? "cursor-crosshair" : ""} ${className}`}
      onClick={handleClick}
      onTouchEnd={handleTouch}
    >
      <defs>
        <linearGradient id="field-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.75 0.17 165)" />
          <stop offset="50%" stopColor="oklch(0.72 0.14 220)" />
          <stop offset="100%" stopColor="oklch(0.70 0.12 280)" />
        </linearGradient>
        <linearGradient id="field-grad-dim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.75 0.17 165 / 30%)" />
          <stop offset="50%" stopColor="oklch(0.72 0.14 220 / 20%)" />
          <stop offset="100%" stopColor="oklch(0.70 0.12 280 / 15%)" />
        </linearGradient>
        <radialGradient id="dot-grad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="oklch(0.80 0.17 165)" />
          <stop offset="50%" stopColor="oklch(0.72 0.16 220)" />
          <stop offset="100%" stopColor="oklch(0.68 0.14 280)" />
        </radialGradient>
      </defs>

      {/* Foul lines */}
      <line x1="150" y1="280" x2="10" y2="140" stroke="url(#field-grad)" strokeWidth="1.5" opacity="0.4" />
      <line x1="150" y1="280" x2="290" y2="140" stroke="url(#field-grad)" strokeWidth="1.5" opacity="0.4" />

      {/* Outfield fence arc */}
      <path d="M 10 140 A 198 198 0 0 1 290 140" fill="none" stroke="url(#field-grad)" strokeWidth="2" opacity="0.5" />

      {/* Infield diamond fill */}
      <path d="M 150 280 L 80 210 L 150 140 L 220 210 Z" fill="url(#field-grad-dim)" />

      {/* Base paths */}
      <line x1="150" y1="280" x2="80" y2="210" stroke="url(#field-grad)" strokeWidth="1.5" />
      <line x1="80" y1="210" x2="150" y2="140" stroke="url(#field-grad)" strokeWidth="1.5" />
      <line x1="150" y1="140" x2="220" y2="210" stroke="url(#field-grad)" strokeWidth="1.5" />
      <line x1="220" y1="210" x2="150" y2="280" stroke="url(#field-grad)" strokeWidth="1.5" />

      {/* Bases */}
      <rect x="145" y="275" width="10" height="10" fill="url(#field-grad)" transform="rotate(45 150 280)" />
      <rect x="75" y="205" width="10" height="10" fill="url(#field-grad)" opacity="0.7" transform="rotate(45 80 210)" />
      <rect x="145" y="135" width="10" height="10" fill="url(#field-grad)" opacity="0.7" transform="rotate(45 150 140)" />
      <rect x="215" y="205" width="10" height="10" fill="url(#field-grad)" opacity="0.7" transform="rotate(45 220 210)" />

      {/* Pitcher's mound */}
      <circle cx="150" cy="218" r="4" fill="none" stroke="url(#field-grad)" strokeWidth="1.5" opacity="0.5" />

      {/* Position labels */}
      {[
        { x: 150, y: 212, label: "P" },
        { x: 150, y: 296, label: "C" },
        { x: 215, y: 195, label: "1B" },
        { x: 185, y: 163, label: "2B" },
        { x: 85, y: 195, label: "3B" },
        { x: 115, y: 163, label: "SS" },
        { x: 50, y: 155, label: "LF" },
        { x: 115, y: 108, label: "LC" },
        { x: 185, y: 108, label: "RC" },
        { x: 250, y: 155, label: "RF" },
      ].map((pos) => (
        <text
          key={pos.label}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          fill="url(#field-grad)"
          fontSize="11"
          fontWeight="bold"
          opacity="0.5"
        >
          {pos.label}
        </text>
      ))}

      {/* Ghost markers — previous at-bats for this hitter */}
      {ghostMarkers.map((m, i) => (
        <g key={`ghost-${i}`} opacity="0.25">
          <circle
            cx={m.x}
            cy={m.y}
            r="5"
            fill={getResultColor(m.result)}
            stroke="oklch(0.95 0.005 270)"
            strokeWidth="1"
          />
        </g>
      ))}

      {/* Trajectory line from home plate to selected point */}
      {selectedPoint && (
        <TrajectoryPath
          fromX={homeX}
          fromY={homeY}
          toX={selectedPoint.x}
          toY={selectedPoint.y}
          hitType={hitType}
        />
      )}

      {/* Existing markers (current game, all batters) */}
      {markers.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r="6"
          fill={getResultColor(m.result)}
          stroke="oklch(0.95 0.005 270)"
          strokeWidth="1.5"
          opacity="0.85"
        />
      ))}

      {/* Selected point — pulse animation with gradient */}
      {selectedPoint && (
        <>
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r="12"
            fill="url(#dot-grad)"
            opacity="0.3"
          >
            <animate attributeName="r" values="8;14;8" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r="7"
            fill="url(#dot-grad)"
            stroke="oklch(0.95 0.005 270)"
            strokeWidth="2.5"
          />
        </>
      )}
    </svg>
  );
}

/**
 * Trajectory path from home plate to the ball landing spot.
 *
 * The arc shape reflects the hit type:
 *   GB (ground ball) — low bouncing line with small humps
 *   LD (line drive)  — nearly straight, slight upward arc
 *   FB (fly ball)    — moderate arc peaking ~40% of the way up
 *   PU (pop up)      — exaggerated high arc, almost vertical peak
 *   null (unknown)   — simple straight dashed line
 */
function TrajectoryPath({
  fromX,
  fromY,
  toX,
  toY,
  hitType,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hitType?: HitType | null;
}) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) return null;

  // Unit direction and perpendicular (for arc control points)
  const ux = dx / dist;
  const uy = dy / dist;
  // Perpendicular (rotated 90 degrees CCW) — points "up" relative to the trajectory
  const px = -uy;
  const py = ux;

  const color = "oklch(0.75 0.17 165)";

  if (!hitType) {
    // Simple dashed line
    return (
      <line
        x1={fromX} y1={fromY} x2={toX} y2={toY}
        stroke={color} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4"
      />
    );
  }

  if (hitType === "GB") {
    // Ground ball: low bouncing trajectory with 3 small humps
    const bounces = 3;
    const segLen = dist / bounces;
    const bounceHeight = Math.min(12, dist * 0.06);
    let d = `M ${fromX} ${fromY}`;

    for (let i = 0; i < bounces; i++) {
      const t0 = i / bounces;
      const t1 = (i + 1) / bounces;
      const tMid = (t0 + t1) / 2;
      // Midpoint of this segment
      const mx = fromX + dx * tMid;
      const my = fromY + dy * tMid;
      // Control point offset perpendicular (arcs get smaller with each bounce)
      const h = bounceHeight * (1 - i * 0.3);
      const cx = mx + px * h;
      const cy = my + py * h;
      // End of segment
      const ex = fromX + dx * t1;
      const ey = fromY + dy * t1;
      d += ` Q ${cx} ${cy} ${ex} ${ey}`;
    }

    return (
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" opacity="0.5" />
    );
  }

  if (hitType === "LD") {
    // Line drive: slight arc, peaks early (~30% along the path)
    const peakT = 0.3;
    const arcHeight = dist * 0.08;
    const cx = fromX + dx * peakT + px * arcHeight;
    const cy = fromY + dy * peakT + py * arcHeight;

    return (
      <path
        d={`M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`}
        fill="none" stroke={color} strokeWidth="1.8" opacity="0.5"
      />
    );
  }

  if (hitType === "FB") {
    // Fly ball: moderate arc, peaks at ~40%
    const peakT = 0.4;
    const arcHeight = dist * 0.25;
    const cx = fromX + dx * peakT + px * arcHeight;
    const cy = fromY + dy * peakT + py * arcHeight;

    return (
      <path
        d={`M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`}
        fill="none" stroke={color} strokeWidth="1.8" opacity="0.5"
      />
    );
  }

  if (hitType === "PU") {
    // Pop up: exaggerated high arc, peaks at ~35% with extreme height
    const peakT = 0.35;
    const arcHeight = dist * 0.55;
    const cx = fromX + dx * peakT + px * arcHeight;
    const cy = fromY + dy * peakT + py * arcHeight;

    return (
      <path
        d={`M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`}
        fill="none" stroke={color} strokeWidth="1.8" opacity="0.5"
      />
    );
  }

  return null;
}
