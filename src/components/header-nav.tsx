"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/players", label: "Players" },
  { href: "/schedule", label: "Schedule" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function HeaderNav() {
  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
          >
            {link.label}
          </Link>
        ))}
        <ThemeToggle />
        <UserMenu />
      </nav>

      {/* Mobile: theme toggle + user menu */}
      <div className="md:hidden flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu />
      </div>
    </>
  );
}
