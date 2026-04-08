"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  dropUp?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder = "Select...", className = "", dropUp = false }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const maxHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const shouldDropUp = dropUp || spaceBelow < maxHeight;
      setPos({
        top: shouldDropUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [open, dropUp]);

  // Scroll selected item into view when opening
  useEffect(() => {
    if (open && listRef.current && value) {
      const el = listRef.current.querySelector(`[data-value="${value}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [open, value]);

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`h-full w-full flex items-center justify-between gap-1 rounded-xl border-2 px-3 text-left transition-all active:scale-[0.98] select-none ${
          open
            ? "border-primary/50 bg-primary/5"
            : "border-border/50 bg-muted/30 hover:border-border"
        }`}
      >
        <span className={`truncate text-sm ${selected ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={listRef}
          className="fixed z-50 rounded-xl border-2 border-border/50 bg-card shadow-xl overflow-hidden animate-slide-up"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: "200px", overflowY: "auto" }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-value={opt.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                opt.value === value
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-foreground hover:bg-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
