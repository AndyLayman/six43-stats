"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { LogOut, Settings, User } from "iconoir-react";

export function UserMenu() {
  const { user, memberships, activeTeam, setActiveTeam, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const initial = (user.email?.[0] ?? "?").toUpperCase();
  const roleLabel = activeTeam?.role
    ? activeTeam.role.charAt(0).toUpperCase() + activeTeam.role.slice(1)
    : "";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold hover:bg-primary/30 transition-colors"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-card border border-border/50 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
            {roleLabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{roleLabel}{activeTeam?.team_name ? ` · ${activeTeam.team_name}` : ""}</p>
            )}
          </div>
          {memberships.length > 1 && (
            <div className="px-4 py-2 border-b border-border/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Switch Team</p>
              {memberships.map((m) => (
                <button
                  key={m.team_id}
                  onClick={() => {
                    setActiveTeam(m);
                    setOpen(false);
                    router.refresh();
                  }}
                  className={`flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
                    m.team_id === activeTeam?.team_id
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {m.team_name}
                  {m.team_id === activeTeam?.team_id && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <Settings width={16} height={16} />
            Settings
          </button>
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.push("/login");
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <LogOut width={16} height={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
