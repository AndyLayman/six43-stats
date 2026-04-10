"use client";

import { useCallback } from "react";
import { getResultColor } from "@/lib/scoring/scorebook";
import type { PlateAppearanceResult, HitType } from "@/lib/scoring/types";

interface SprayChartProps {
  onClick?: (x: number, y: number) => void;
  markers?: { x: number; y: number; result: PlateAppearanceResult }[];
  ghostMarkers?: { x: number; y: number; result: PlateAppearanceResult; hitType?: HitType | null }[];
  selectedPoint?: { x: number; y: number } | null;
  hitType?: HitType | null;
  runners?: { first: boolean; second: boolean; third: boolean };
  interactive?: boolean;
  className?: string;
}

export function SprayChart({
  onClick,
  markers = [],
  ghostMarkers = [],
  selectedPoint,
  hitType,
  runners,
  interactive = true,
  className = "",
}: SprayChartProps) {
  // viewBox is "0 70 300 240" — x: 0-300, y: 70-310
  const getCoords = useCallback((svg: SVGSVGElement, clientX: number, clientY: number) => {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 300;
    const y = ((clientY - rect.top) / rect.height) * 240 + 70;
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
      {/* Foul lines */}
      <line x1="150" y1="280" x2="10" y2="140" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.4" />
      <line x1="150" y1="280" x2="290" y2="140" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.4" />

      {/* Outfield fence arc */}
      <path d="M 10 155 A 160 160 0 0 1 290 155" fill="none" stroke="#E9D7B4" strokeWidth="2" opacity="0.5" />

      {/* Infield diamond fill */}
      <path d="M 150 280 L 80 210 L 150 140 L 220 210 Z" fill="#E9D7B4" opacity="0.1" />

      {/* Base paths */}
      <line x1="150" y1="280" x2="80" y2="210" stroke="#E9D7B4" strokeWidth="1.5" />
      <line x1="80" y1="210" x2="150" y2="140" stroke="#E9D7B4" strokeWidth="1.5" />
      <line x1="150" y1="140" x2="220" y2="210" stroke="#E9D7B4" strokeWidth="1.5" />
      <line x1="220" y1="210" x2="150" y2="280" stroke="#E9D7B4" strokeWidth="1.5" />

      {/* Bases */}
      <rect x="145" y="275" width="10" height="10" fill="#E9D7B4" transform="rotate(45 150 280)" />
      {/* 1st base */}
      <rect x="215" y="205" width="10" height="10"
        fill={runners?.first ? "#E9D7B4" : "#111111"}
        stroke="#E9D7B4"
        strokeWidth="1.5"
        opacity={runners?.first ? 1 : 0.7}
        transform="rotate(45 220 210)"
      />
      {runners?.first && (
        <circle cx="220" cy="210" r="6" fill="#E9D7B4" opacity="0.3">
          <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {/* 2nd base */}
      <rect x="145" y="135" width="10" height="10"
        fill={runners?.second ? "#E9D7B4" : "#111111"}
        stroke="#E9D7B4"
        strokeWidth="1.5"
        opacity={runners?.second ? 1 : 0.7}
        transform="rotate(45 150 140)"
      />
      {runners?.second && (
        <circle cx="150" cy="140" r="6" fill="#E9D7B4" opacity="0.3">
          <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {/* 3rd base */}
      <rect x="75" y="205" width="10" height="10"
        fill={runners?.third ? "#E9D7B4" : "#111111"}
        stroke="#E9D7B4"
        strokeWidth="1.5"
        opacity={runners?.third ? 1 : 0.7}
        transform="rotate(45 80 210)"
      />
      {runners?.third && (
        <circle cx="80" cy="210" r="6" fill="#E9D7B4" opacity="0.3">
          <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Pitcher's mound */}
      <circle cx="150" cy="218" r="8" fill="none" stroke="#E9D7B4" strokeWidth="1.5" opacity="0.5" />

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
          fill="#E9D7B4"
          fontSize="8"
          fontWeight="bold"
          opacity="0.5"
        >
          {pos.label}
        </text>
      ))}

      {/* Ghost markers — previous at-bats for this hitter */}
      {ghostMarkers.map((m, i) => (
        <g key={`ghost-${i}`} opacity="0.2">
          {m.hitType && (
            <TrajectoryPath
              fromX={homeX}
              fromY={homeY}
              toX={m.x}
              toY={m.y}
              hitType={m.hitType}
              ghost
            />
          )}
          <circle
            cx={m.x}
            cy={m.y}
            r="3.5"
            fill={getResultColor(m.result)}
            stroke="#F7F7F7"
            strokeWidth="0.75"
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
          stroke="#F7F7F7"
          strokeWidth="1.5"
          opacity="0.85"
        />
      ))}

      {/* Selected point — pulse animation */}
      {selectedPoint && (
        <>
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r="8"
            fill="#E9D7B4"
            opacity="0.3"
          >
            <animate attributeName="r" values="5;10;5" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r="5"
            fill="#E9D7B4"
            stroke="#F7F7F7"
            strokeWidth="1.5"
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
  ghost = false,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hitType?: HitType | null;
  ghost?: boolean;
}) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) return null;

  // Unit direction and perpendicular (for arc control points)
  const ux = dx / dist;
  const uy = dy / dist;
  // Perpendicular — always points toward center of field (x=150)
  // CCW perpendicular is (-uy, ux); flip it if the ball is hit to the right
  // so the arc curves inward rather than outward
  const midX = (fromX + toX) / 2;
  const ccwX = -uy;
  const ccwY = ux;
  // Check if CCW perpendicular points toward center (x=150)
  const towardCenter = (150 - midX) * ccwX;
  const sign = towardCenter >= 0 ? 1 : -1;
  const px = ccwX * sign;
  const py = ccwY * sign;

  const color = "#E9D7B4";
  const strokeW = ghost ? 1 : 1.8;
  const strokeOp = ghost ? 0.4 : 0.5;

  // Straight line shadow behind all arc types (skip for ghost markers)
  const shadowLine = ghost ? null : (
    <line
      x1={fromX} y1={fromY} x2={toX} y2={toY}
      stroke="black" strokeWidth="1.6" opacity="0.25"
    />
  );

  if (!hitType) {
    // Simple dashed line (no shadow needed, it IS the line)
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
      <>{shadowLine}<path d={d} fill="none" stroke={color} strokeWidth={strokeW} opacity={strokeOp} /></>
    );
  }

  if (hitType === "LD") {
    // Line drive: slight arc, peaks early (~30% along the path)
    const peakT = 0.3;
    const arcHeight = dist * 0.08;
    const cx = fromX + dx * peakT + px * arcHeight;
    const cy = fromY + dy * peakT + py * arcHeight;

    return (
      <>{shadowLine}<path
        d={`M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`}
        fill="none" stroke={color} strokeWidth={strokeW} opacity={strokeOp}
      /></>
    );
  }

  if (hitType === "FB") {
    // Fly ball: moderate arc, peaks at ~40%
    const peakT = 0.4;
    const arcHeight = dist * 0.25;
    const cx = fromX + dx * peakT + px * arcHeight;
    const cy = fromY + dy * peakT + py * arcHeight;

    return (
      <>{shadowLine}<path
        d={`M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`}
        fill="none" stroke={color} strokeWidth={strokeW} opacity={strokeOp}
      /></>
    );
  }

  if (hitType === "PU") {
    // Pop up: exaggerated high arc, peaks at ~65% (closer to landing spot)
    const peakT = 0.65;
    const arcHeight = dist * 0.55;
    const cx = fromX + dx * peakT + px * arcHeight;
    const cy = fromY + dy * peakT + py * arcHeight;

    return (
      <>{shadowLine}<path
        d={`M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`}
        fill="none" stroke={color} strokeWidth={strokeW} opacity={strokeOp}
      /></>
    );
  }

  return null;
}
