"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeSimple, Group, Calendar, LeaderboardStar } from "iconoir-react";

const tabs = [
  { href: "/", label: "Home", Icon: HomeSimple },
  { href: "/players", label: "Players", Icon: Group },
  { href: "/schedule", label: "Schedule", Icon: Calendar },
  { href: "/leaderboard", label: "Leaders", Icon: LeaderboardStar },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border/50 bg-sidebar" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
            style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
          >
            <Icon width={22} height={22} strokeWidth={active ? 2 : 1.5} />
            <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
