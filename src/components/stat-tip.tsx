"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

const STAT_DEFINITIONS: Record<string, string> = {
  G: "Games Played",
  PA: "Plate Appearances",
  AB: "At Bats",
  H: "Hits",
  "1B": "Singles",
  "2B": "Doubles",
  "3B": "Triples",
  HR: "Home Runs",
  RBI: "Runs Batted In",
  BB: "Walks (Base on Balls)",
  SO: "Strikeouts",
  SB: "Stolen Bases",
  AVG: "Batting Average",
  OBP: "On-Base Percentage",
  SLG: "Slugging Percentage",
  OPS: "On-Base + Slugging",
  PO: "Putouts",
  A: "Assists",
  E: "Errors",
  TC: "Total Chances",
  "FLD%": "Fielding Percentage",
};

export function StatTip({ label, children }: { label: string; children?: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const definition = STAT_DEFINITIONS[label];

  const showTip = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.top - 6,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const hideTip = useCallback(() => setPos(null), []);

  if (!definition) return <>{children ?? label}</>;

  return (
    <span
      ref={ref}
      className="inline-block cursor-help"
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onTouchStart={() => pos ? hideTip() : showTip()}
    >
      <span className="border-b border-dotted border-muted-foreground/40">{children ?? label}</span>
      {pos && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translate(-50%, -100%)",
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "#222",
              color: "#eee",
              fontSize: 11,
              lineHeight: 1.3,
              padding: "4px 8px",
              borderRadius: 6,
              fontWeight: 500,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {definition}
          </div>
          <div
            style={{
              width: 0,
              height: 0,
              margin: "0 auto",
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid #222",
            }}
          />
        </div>,
        document.body
      )}
    </span>
  );
}
