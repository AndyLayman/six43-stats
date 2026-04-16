"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  format?: (v: number) => string;
  duration?: number;
}

export function AnimatedNumber({ value, format, duration = 600 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState("0");
  const prevRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;

      if (format) {
        setDisplay(format(current));
      } else {
        setDisplay(String(Math.round(current)));
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    prevRef.current = value;

    return () => cancelAnimationFrame(rafRef.current);
  }, [value, format, duration]);

  return <>{display}</>;
}
