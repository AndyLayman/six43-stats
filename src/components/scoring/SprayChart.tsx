"use client";

import { useCallback } from "react";
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
    e.preventDefault(); // prevent scroll and double-tap zoom
    const touch = e.changedTouches[0];
    const { x, y } = getCoords(e.currentTarget, touch.clientX, touch.clientY);
    onClick(x, y);
  }

  return (
    <svg
      viewBox="0 0 300 300"
      className={`w-full max-w-[300px] select-none ${interactive ? "cursor-crosshair" : ""} ${className}`}
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
      </defs>

      {/* Foul lines — extend through 3B (80,210) and 1B (220,210) from home (150,280) */}
      <line x1="150" y1="280" x2="10" y2="140" stroke="url(#field-grad)" strokeWidth="1.5" opacity="0.4" />
      <line x1="150" y1="280" x2="290" y2="140" stroke="url(#field-grad)" strokeWidth="1.5" opacity="0.4" />

      {/* Outfield fence arc — connects foul line endpoints, centered on home plate */}
      <path d="M 10 140 A 198 198 0 0 1 290 140" fill="none" stroke="url(#field-grad)" strokeWidth="2" opacity="0.5" />

      {/* Infield diamond fill (very subtle) */}
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
        { x: 150, y: 226, label: "P" },
        { x: 150, y: 296, label: "C" },
        { x: 235, y: 214, label: "1B" },
        { x: 190, y: 178, label: "2B" },
        { x: 65, y: 214, label: "3B" },
        { x: 110, y: 178, label: "SS" },
        { x: 50, y: 155, label: "LF" },
        { x: 150, y: 100, label: "CF" },
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

      {/* Existing markers */}
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

      {/* Selected point — pulse animation */}
      {selectedPoint && (
        <>
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r="12"
            fill="oklch(0.75 0.17 165)"
            opacity="0.3"
          >
            <animate attributeName="r" values="8;14;8" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r="7"
            fill="oklch(0.75 0.17 165)"
            stroke="oklch(0.95 0.005 270)"
            strokeWidth="2.5"
          />
        </>
      )}
    </svg>
  );
}
