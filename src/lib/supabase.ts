import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// In-memory mutex that replaces the browser Web Locks API.
// Web Locks serialized ALL parallel Supabase requests (30s+ loads).
// A no-op lock fixed that but broke token refresh (refresh tokens are single-use,
// so concurrent refreshes race and destroy the session → mobile stuck on spinner).
// This mutex serializes calls with the same lock name (preventing concurrent
// token refreshes) while still allowing truly parallel data queries.
interface LockEntry {
  promise: Promise<unknown>;
  reject: (err: unknown) => void;
}
const activeLocks = new Map<string, LockEntry>();

// iOS can leave the fetch from a lock-holding fn() pending forever after
// a tab is briefly suspended. That permanently blocks every subsequent
// auth-gated query. When the tab transitions hidden → visible:
//   1. Reject and drop any entry in our outer lock map.
//   2. Reset auth-js's internal lockAcquired / pendingInLock state —
//      those guard a fast-path that would otherwise queue every new
//      _useSession call behind the stuck fn() forever.
// The stuck fn() is orphaned; when its fetch eventually resolves (or
// rejects) its try/finally is a no-op against the new state.
function resetStuckLocks(authClient: unknown) {
  for (const [name, entry] of activeLocks) {
    entry.reject(new Error("Lock holder suspended across tab hide"));
    activeLocks.delete(name);
  }
  // auth-js marks these private via TS but they are regular instance
  // properties at runtime. Resetting is the only way to unstick the
  // queue when iOS has orphaned the fn() that would normally clear them.
  const a = authClient as { lockAcquired?: boolean; pendingInLock?: unknown[] };
  if (a && typeof a === "object") {
    a.lockAcquired = false;
    a.pendingInLock = [];
  }
}

let lastHiddenAt: number | null = null;
let lastVisibleAt: number | null = null;
if (typeof document !== "undefined") {
  let wasHidden = false;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      lastHiddenAt = Date.now();
      wasHidden = true;
      return;
    }
    if (document.visibilityState === "visible") {
      lastVisibleAt = Date.now();
      if (wasHidden) {
        wasHidden = false;
        resetStuckLocks(supabase.auth);
      }
    }
  });
}

export interface SupabaseDebugInfo {
  outerLocks: string[];
  authLockAcquired: boolean;
  pendingInLockLength: number;
  lastHiddenAt: number | null;
  lastVisibleAt: number | null;
}

export function getSupabaseDebugInfo(): SupabaseDebugInfo {
  const a = (supabase?.auth as unknown as { lockAcquired?: boolean; pendingInLock?: unknown[] }) ?? {};
  return {
    outerLocks: [...activeLocks.keys()],
    authLockAcquired: !!a.lockAcquired,
    pendingInLockLength: Array.isArray(a.pendingInLock) ? a.pendingInLock.length : 0,
    lastHiddenAt,
    lastVisibleAt,
  };
}

export const supabase = createBrowserClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lock: async (name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
        // Wait for the current holder of this lock name (if any) to finish
        while (activeLocks.has(name)) {
          try {
            await activeLocks.get(name)!.promise;
          } catch {
            // Previous holder threw (or was evicted on tab wake) — we still proceed
          }
        }

        // Now we hold the lock — store our promise so others wait
        let resolve: () => void;
        let reject: (err: unknown) => void;
        const gate = new Promise<void>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        const entry: LockEntry = { promise: gate, reject: reject! };
        activeLocks.set(name, entry);

        try {
          const result = await fn();
          resolve!();
          return result;
        } catch (err) {
          reject!(err);
          throw err;
        } finally {
          // Only delete if we're still the current holder
          if (activeLocks.get(name) === entry) {
            activeLocks.delete(name);
          }
        }
      },
    },
  }
);
