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
  gate: Promise<unknown>;
  reject: (err: unknown) => void;
  acquiredAt: number;
}
const activeLocks = new Map<string, LockEntry>();

function makeAcquireTimeoutError(name: string): Error {
  // Supabase auth-js duck-types this via `isAcquireTimeout`; see
  // node_modules/@supabase/auth-js/.../lib/locks.js
  const err = new Error(`Acquiring lock "${name}" timed out`) as Error & { isAcquireTimeout?: boolean };
  err.isAcquireTimeout = true;
  return err;
}

// A backgrounded tab can suspend JS mid-fetch, leaving the lock holder's
// fn() pending forever. When we come back to the foreground, drop any lock
// that's been held longer than a few seconds so new requests can proceed.
const STUCK_LOCK_MS = 5_000;
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    for (const [name, entry] of activeLocks) {
      if (now - entry.acquiredAt >= STUCK_LOCK_MS) {
        // Unblock anyone awaiting this gate, then drop the entry
        entry.reject(new Error("Lock holder appears stuck after tab wake"));
        activeLocks.delete(name);
      }
    }
  });
}

export const supabase = createBrowserClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      // acquireTimeout semantics (from @supabase/auth-js):
      //   < 0: wait indefinitely
      //   = 0: non-blocking — throw with isAcquireTimeout=true if held
      //   > 0: wait up to that many ms, throw if not acquired
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
        if (activeLocks.has(name)) {
          if (acquireTimeout === 0) {
            throw makeAcquireTimeoutError(name);
          }

          const hasDeadline = acquireTimeout > 0;
          const deadline = hasDeadline ? Date.now() + acquireTimeout : Infinity;

          while (activeLocks.has(name)) {
            const remaining = hasDeadline ? deadline - Date.now() : Infinity;
            if (remaining <= 0) {
              throw makeAcquireTimeoutError(name);
            }
            try {
              if (hasDeadline) {
                let timer: ReturnType<typeof setTimeout> | undefined;
                await Promise.race([
                  activeLocks.get(name)!.gate,
                  new Promise((_, rej) => {
                    timer = setTimeout(() => rej(new Error("lock-timeout")), remaining);
                  }),
                ]).finally(() => { if (timer) clearTimeout(timer); });
              } else {
                await activeLocks.get(name)!.gate;
              }
            } catch {
              // Previous holder threw or we hit a race-timeout — loop and re-check
            }
          }
        }

        // Now we hold the lock — store our promise so others wait
        let resolve: () => void;
        let reject: (err: unknown) => void;
        const gate = new Promise<void>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        const entry: LockEntry = { gate, reject: reject!, acquiredAt: Date.now() };
        activeLocks.set(name, entry);

        try {
          const result = await fn();
          resolve!();
          return result;
        } catch (err) {
          reject!(err);
          throw err;
        } finally {
          // Only delete if we're still the current holder (otherwise an
          // on-wake cleanup already dropped us and a new holder may exist)
          if (activeLocks.get(name) === entry) {
            activeLocks.delete(name);
          }
        }
      },
    },
  }
);
