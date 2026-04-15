"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export type TeamRole = "admin" | "manager" | "teammate" | "parent" | "guest";

export interface TeamMembership {
  team_id: string;
  team_name: string;
  team_slug: string;
  role: TeamRole;
  player_id: number | null;
}

interface AuthContextValue {
  user: User | null;
  memberships: TeamMembership[];
  activeTeam: TeamMembership | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (...roles: TeamRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  memberships: [],
  activeTeam: null,
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
  const [loading, setLoading] = useState(true);

  const loadMemberships = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, player_id, teams(name, slug)")
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to load team memberships:", error);
        setMemberships([]);
        return [];
      }

      if (data && data.length > 0) {
        const mapped = data.map((m: Record<string, unknown>) => {
          const team = m.teams as { name: string; slug: string } | null;
          return {
            team_id: m.team_id as string,
            team_name: team?.name ?? "",
            team_slug: team?.slug ?? "",
            role: m.role as TeamRole,
            player_id: m.player_id as number | null,
          };
        });
        setMemberships(mapped);
        return mapped;
      }

      // First user auto-join: assign as admin of the default team
      const { data: defaultTeam } = await supabase
        .from("teams")
        .select("id, name, slug")
        .eq("slug", "default")
        .single();

      if (defaultTeam) {
        await supabase.from("team_members").insert({
          team_id: defaultTeam.id,
          user_id: userId,
          role: "admin",
        });
        const membership: TeamMembership = {
          team_id: defaultTeam.id,
          team_name: defaultTeam.name,
          team_slug: defaultTeam.slug,
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadMemberships(u.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
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

    return () => subscription.unsubscribe();
  }, [loadMemberships]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMemberships([]);
  }, []);

  const activeTeam = memberships[0] ?? null;

  const hasRole = useCallback(
    (...roles: TeamRole[]) => {
      if (!activeTeam) return false;
      return roles.includes(activeTeam.role);
    },
    [activeTeam]
  );

  return (
    <AuthContext.Provider value={{ user, memberships, activeTeam, loading, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
