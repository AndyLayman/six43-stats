"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type TeamRole } from "@/components/auth-provider";

type Member = {
  user_id: string;
  role: TeamRole;
  player_id: number | null;
  email: string;
  is_self: boolean;
};

type Invite = {
  id: string;
  email: string;
  role: TeamRole;
  created_at: string;
};

const ROLES: TeamRole[] = ["admin", "manager", "teammate", "parent", "guest"];
const ROLE_LABELS: Record<TeamRole, string> = {
  admin: "Admin",
  manager: "Manager",
  teammate: "Teammate",
  parent: "Parent",
  guest: "Guest",
};

export function TeamMembersCard() {
  const { activeTeam, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("teammate");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTeam) return;
    setErr(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/team/members?team_id=${activeTeam.team_id}`),
        isAdmin ? fetch(`/api/team/invite?team_id=${activeTeam.team_id}`) : Promise.resolve(null),
      ]);
      const mData = await membersRes.json();
      if (!membersRes.ok) throw new Error(mData.error ?? "Failed to load members");
      setMembers(mData.members ?? []);
      if (invitesRes) {
        const iData = await invitesRes.json();
        if (invitesRes.ok) setInvites(iData.invites ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeTeam, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const sendInvite = async () => {
    if (!activeTeam) return;
    setSending(true);
    setSentMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          team_id: activeTeam.team_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invite");
      setSentMsg(`Invite sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
      setInviteRole("teammate");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const changeRole = async (userId: string, role: TeamRole) => {
    if (!activeTeam) return;
    setErr(null);
    const res = await fetch(`/api/team/members/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ team_id: activeTeam.team_id, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Failed to change role");
      return;
    }
    await load();
  };

  const removeMember = async (userId: string, email: string) => {
    if (!activeTeam) return;
    if (!confirm(`Remove ${email} from this team?`)) return;
    setErr(null);
    const res = await fetch(
      `/api/team/members/${userId}?team_id=${activeTeam.team_id}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Failed to remove member");
      return;
    }
    await load();
  };

  const cancelInvite = async (id: string) => {
    setErr(null);
    const res = await fetch(`/api/team/invite/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Failed to cancel invite");
      return;
    }
    await load();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
        <CardContent><div className="text-sm text-muted-foreground py-4">Loading…</div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {err && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {/* Members list */}
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="rounded-lg border border-border/50 px-3 py-2 space-y-2"
            >
              <div className="text-sm font-medium break-all">
                {m.email || "(no email)"}
                {m.is_self && <span className="text-muted-foreground"> · you</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                {isAdmin && !m.is_self ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value as TeamRole)}
                    className="h-8 rounded-md border border-border/50 bg-input/50 px-2 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {ROLE_LABELS[m.role]}
                  </span>
                )}
                {isAdmin && !m.is_self && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeMember(m.user_id, m.email)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pending invites */}
        {isAdmin && invites.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending invites</div>
            {invites.map((i) => (
              <div
                key={i.id}
                className="rounded-lg border border-dashed border-border/50 px-3 py-2 space-y-2"
              >
                <div className="text-sm break-all">{i.email}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Invited as {ROLE_LABELS[i.role]}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => cancelInvite(i.id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invite form */}
        {isAdmin && (
          <div className="space-y-2 pt-2 border-t border-border/30">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Invite by email</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="inviteEmail" className="sr-only">Email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="person@example.com"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="h-10 rounded-md border border-border/50 bg-input/50 px-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <Button
                onClick={sendInvite}
                disabled={sending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())}
              >
                {sending ? "Sending…" : "Send invite"}
              </Button>
            </div>
            {sentMsg && <div className="text-xs text-muted-foreground">{sentMsg}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
