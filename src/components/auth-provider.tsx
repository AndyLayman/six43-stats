"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export type TeamRole = "admin" | "manager" | "teammate" | "parent" | "guest";

export interface TeamMembership {
  team_id: string;
  team_name: string;
  team_slug: string;
  team_logo_svg: string | null;
  team_color_bg: string | null;
  team_color_fg: string | null;
  role: TeamRole;
  player_id: number | null;
}

interface AuthContextValue {
  user: User | null;
  memberships: TeamMembership[];
  activeTeam: TeamMembership | null;
  setActiveTeam: (team: TeamMembership) => void;
  refreshMemberships: () => Promise<void>;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (...roles: TeamRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  memberships: [],
  activeTeam: null,
  setActiveTeam: () => {},
  refreshMemberships: async () => {},
  loading: true,
  signOut: async () => {},
  hasRole: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMemberships = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, player_id, teams(name, slug, logo_svg, color_bg, color_fg)")
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to load team memberships:", error);
        setMemberships([]);
        return [];
      }

      if (data && data.length > 0) {
        const mapped = data.map((m: Record<string, unknown>) => {
          const team = m.teams as {
            name: string;
            slug: string;
            logo_svg: string | null;
            color_bg: string | null;
            color_fg: string | null;
          } | null;
          return {
            team_id: m.team_id as string,
            team_name: team?.name ?? "",
            team_slug: team?.slug ?? "",
            team_logo_svg: team?.logo_svg ?? null,
            team_color_bg: team?.color_bg ?? null,
            team_color_fg: team?.color_fg ?? null,
            role: m.role as TeamRole,
            player_id: m.player_id as number | null,
          };
        });
        setMemberships(mapped);
        return mapped;
      }

      // First user auto-join: assign as admin of the default team
      const { data: defaultTeam, error: teamError } = await supabase
        .from("teams")
        .select("id, name, slug, logo_svg, color_bg, color_fg")
        .eq("slug", "default")
        .single();

      if (teamError) {
        console.error("[Auth] Failed to find default team:", teamError);
      }

      if (defaultTeam) {
        const { error: insertError } = await supabase.from("team_members").insert({
          team_id: defaultTeam.id,
          user_id: userId,
          role: "admin",
        });
        if (insertError) {
          console.error("[Auth] Failed to auto-join team:", insertError);
        }
        const membership: TeamMembership = {
          team_id: defaultTeam.id,
          team_name: defaultTeam.name,
          team_slug: defaultTeam.slug,
          team_logo_svg: defaultTeam.logo_svg ?? null,
          team_color_bg: defaultTeam.color_bg ?? null,
          team_color_fg: defaultTeam.color_fg ?? null,
          role: "admin",
          player_id: null,
        };
        setMemberships([membership]);
        return [membership];
      }

      setMemberships([]);
      return [];
    } catch (err) {
      console.error("Error loading memberships:", err);
      setMemberships([]);
      return [];
    }
  }, []);

  useEffect(() => {
    // Guard against iOS leaving the initial getSession() fetch pending
    // forever after a quick tab suspend. If the call doesn't resolve in
    // 10s, fall through to the unauthenticated path so the UI isn't
    // stuck at loading=true and every page's load() can proceed.
    const AUTH_TIMEOUT_MS = 10_000;
    let resolved = false;
    const sessionTimer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.warn("[Auth] getSession() timed out; continuing unauthenticated");
      setLoading(false);
    }, AUTH_TIMEOUT_MS);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(sessionTimer);
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadMemberships(u.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(sessionTimer);
      console.error("[Auth] getSession() failed:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser);
        if (newUser) {
          await loadMemberships(newUser.id);
        } else {
          setMemberships([]);
        }
      }
    );

    // If iOS suspended the initial getSession() and we fell through
    // unauthenticated, retry on tab return. A valid session will
    // repopulate user without requiring a page reload.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user ?? null;
        setUser((prev) => {
          if (prev?.id === u?.id) return prev;
          if (u) loadMemberships(u.id);
          else setMemberships([]);
          return u;
        });
      }).catch(() => { /* ignore; nothing changed */ });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(sessionTimer);
    };
  }, [loadMemberships]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMemberships([]);
  }, []);

  const refreshMemberships = useCallback(async () => {
    if (user) await loadMemberships(user.id);
  }, [user, loadMemberships]);

  const activeTeam = memberships.find((m) => m.team_id === activeTeamId) ?? memberships[0] ?? null;

  const setActiveTeam = useCallback((team: TeamMembership) => {
    setActiveTeamId(team.team_id);
    try { localStorage.setItem("activeTeamId", team.team_id); } catch {}
  }, []);

  // Restore saved team selection on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("activeTeamId");
      if (saved) setActiveTeamId(saved);
    } catch {}
  }, []);

  const hasRole = useCallback(
    (...roles: TeamRole[]) => {
      // If no memberships loaded (e.g. teams tables don't exist yet),
      // grant access rather than blocking everyone
      if (!activeTeam) return memberships.length === 0 && !loading;
      return roles.includes(activeTeam.role);
    },
    [activeTeam, memberships.length, loading]
  );

  return (
    <AuthContext.Provider value={{ user, memberships, activeTeam, setActiveTeam, refreshMemberships, loading, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
