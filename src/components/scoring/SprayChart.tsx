"use client";

import { getResultColor } from "@/lib/scoring/scorebook";
import type { PlateAppearanceResult } from "@/lib/scoring/types";

interface SprayChartProps {
  onClick?: (x: number, y: number) => void;
  markers?: { x: number; y: number; result: PlateAppearanceResult }[];
  selectedPoint?: { x: number; y: number } | null;
  interactive?: boolean;
  className?: string;
}

export function SprayChart({ onClick, markers = [], selectedPoint, interactive = true, className = "" }: SprayChartProps) {
  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!interactive || !onClick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 300;
    const y = ((e.clientY - rect.top) / rect.height) * 300;
    onClick(x, y);
  }

  return (
    <svg
      viewBox="0 0 300 300"
      className={`w-full max-w-[300px] ${interactive ? "cursor-crosshair" : ""} ${className}`}
      onClick={handleClick}
    >
      {/* Grass */}
      <rect x="0" y="0" width="300" height="300" fill="#2d5016" rx="8" />

      {/* Outfield grass (lighter) */}
      <path
        d="M 150 280 L 10 120 A 200 200 0 0 1 290 120 Z"
        fill="#3a6b1e"
      />

      {/* Infield dirt */}
      <path
        d="M 150 280 L 80 210 L 150 140 L 220 210 Z"
        fill="#c4956a"
      />

      {/* Infield grass (diamond interior) */}
      <path
        d="M 150 265 L 95 210 L 150 155 L 205 210 Z"
        fill="#3a6b1e"
      />

      {/* Foul lines */}
      <line x1="150" y1="280" x2="10" y2="120" stroke="white" strokeWidth="1" opacity="0.6" />
      <line x1="150" y1="280" x2="290" y2="120" stroke="white" strokeWidth="1" opacity="0.6" />

      {/* Outfield fence arc */}
      <path
        d="M 10 120 A 200 200 0 0 1 290 120"
        fill="none"
        stroke="white"
        strokeWidth="2"
        opacity="0.5"
      />

      {/* Base paths */}
      <line x1="150" y1="280" x2="80" y2="210" stroke="white" strokeWidth="1.5" />
      <line x1="80" y1="210" x2="150" y2="140" stroke="white" strokeWidth="1.5" />
      <line x1="150" y1="140" x2="220" y2="210" stroke="white" strokeWidth="1.5" />
      <line x1="220" y1="210" x2="150" y2="280" stroke="white" strokeWidth="1.5" />

      {/* Bases */}
      <rect x="145" y="275" width="10" height="10" fill="white" transform="rotate(45 150 280)" /> {/* Home */}
      <rect x="75" y="205" width="10" height="10" fill="white" transform="rotate(45 80 210)" /> {/* 3B */}
      <rect x="145" y="135" width="10" height="10" fill="white" transform="rotate(45 150 140)" /> {/* 2B */}
      <rect x="215" y="205" width="10" height="10" fill="white" transform="rotate(45 220 210)" /> {/* 1B */}

      {/* Pitcher's mound */}
      <circle cx="150" cy="220" r="5" fill="#c4956a" stroke="#a07850" strokeWidth="1" />

      {/* Position labels */}
      {[
        { x: 150, y: 228, label: "P" },
        { x: 150, y: 290, label: "C" },
        { x: 230, y: 205, label: "1B" },
        { x: 185, y: 180, label: "2B" },
        { x: 70, y: 205, label: "3B" },
        { x: 115, y: 180, label: "SS" },
        { x: 55, y: 140, label: "LF" },
        { x: 150, y: 100, label: "CF" },
        { x: 245, y: 140, label: "RF" },
      ].map((pos) => (
        <text
          key={pos.label}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          fill="white"
          fontSize="9"
          fontWeight="bold"
          opacity="0.5"
        >
          {pos.label}
        </text>
      ))}

      {/* Existing markers */}
      {markers.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r="5"
          fill={getResultColor(m.result)}
          stroke="white"
          strokeWidth="1.5"
          opacity="0.85"
        />
      ))}

      {/* Selected point */}
      {selectedPoint && (
        <circle
          cx={selectedPoint.x}
          cy={selectedPoint.y}
          r="7"
          fill="#f59e0b"
          stroke="white"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
