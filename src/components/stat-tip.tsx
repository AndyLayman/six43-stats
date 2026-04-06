"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const definition = STAT_DEFINITIONS[label];

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY - 4,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (show) updatePos();
  }, [show, updatePos]);

  if (!definition) return <>{children ?? label}</>;

  return (
    <span
      ref={ref}
      className="relative inline-block cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow((s) => !s)}
    >
      <span className="border-b border-dotted border-muted-foreground/40">{children ?? label}</span>
      {show && pos && createPortal(
        <span
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <span
            className="inline-block px-2 py-1 rounded shadow-md font-medium"
            style={{ fontSize: "11px", lineHeight: "1", background: "#222", color: "#eee" }}
          >
            {definition}
          </span>
          <span
            className="block mx-auto"
            style={{
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid #222",
            }}
          />
        </span>,
        document.body
      )}
    </span>
  );
}
