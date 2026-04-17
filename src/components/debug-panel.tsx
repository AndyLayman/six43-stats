"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getCacheSnapshot, type CacheSnapshotEntry } from "@/lib/query-cache";
import { getSupabaseDebugInfo, type SupabaseDebugInfo } from "@/lib/supabase";
import { BUILD_SHA, BUILD_BRANCH } from "@/lib/build-info";

function formatAge(ms: number): string {
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m`;
}

function formatAt(t: number | null): string {
  if (t === null) return "—";
  const diff = Date.now() - t;
  return formatAge(diff) + " ago";
}

export function DebugPanel() {
  const search = useSearchParams();
  const enabled = search.get("debug") === "1";
  const { activeTeam, user, loading } = useAuth();
  const [cache, setCache] = useState<CacheSnapshotEntry[]>([]);
  const [sb, setSb] = useState<SupabaseDebugInfo | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      setCache(getCacheSnapshot());
      setSb(getSupabaseDebugInfo());
      setNow(Date.now());
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] bg-black/90 text-white text-[11px] font-mono p-2 border-b border-yellow-500/50 max-h-[50vh] overflow-y-auto"
      style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
    >
      <div className="flex items-center justify-between">
        <strong>DEBUG {BUILD_SHA} · {BUILD_BRANCH}</strong>
        <span className="text-yellow-300">{new Date(now).toLocaleTimeString()}</span>
      </div>
      <div>
        auth.loading=<b>{String(loading)}</b> user=<b>{user?.id?.slice(0, 6) ?? "null"}</b> team=<b>{activeTeam?.team_slug ?? "null"}</b>
      </div>
      {sb && (
        <div>
          outerLocks=[{sb.outerLocks.join(",") || "—"}] authLocked=<b>{String(sb.authLockAcquired)}</b> pending={sb.pendingInLockLength}
          <br />
          hid={formatAt(sb.lastHiddenAt)} vis={formatAt(sb.lastVisibleAt)}
        </div>
      )}
      <div>
        cache ({cache.length}):
        {cache.length === 0 && " empty"}
      </div>
      {cache.map((e) => (
        <div key={e.key} className="pl-2">
          {e.pending && <span className="text-blue-300">⟳ </span>}
          {e.stale && <span className="text-yellow-300">⚠ </span>}
          {e.key} <span className="text-gray-400">{formatAge(e.ageMs)}</span>
        </div>
      ))}
    </div>
  );
}

/** Tiny always-visible build stamp so we can verify which deploy is live. */
export function BuildStamp() {
  return (
    <div
      className="fixed bottom-1 right-1 z-[100] text-[9px] font-mono text-muted-foreground/40 pointer-events-none select-none"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {BUILD_SHA}
    </div>
  );
}
