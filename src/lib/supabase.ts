import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// In-memory mutex that replaces the browser Web Locks API.
// Web Locks serialized ALL parallel Supabase requests (30s+ loads).
// A no-op lock fixed that but broke token refresh (refresh tokens are single-use,
// so concurrent refreshes race and destroy the session → mobile stuck on spinner).
// This mutex serializes calls with the same lock name (preventing concurrent
// token refreshes) while still allowing truly parallel data queries.
const activeLocks = new Map<string, Promise<unknown>>();

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
            await activeLocks.get(name);
          } catch {
            // Previous holder threw — that's fine, we still proceed
          }
        }

        // Now we hold the lock — store our promise so others wait
        let resolve: () => void;
        let reject: (err: unknown) => void;
        const gate = new Promise<void>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        activeLocks.set(name, gate);

        try {
          const result = await fn();
          resolve!();
          return result;
        } catch (err) {
          reject!(err);
          throw err;
        } finally {
          // Only delete if we're still the current holder
          if (activeLocks.get(name) === gate) {
            activeLocks.delete(name);
          }
        }
      },
    },
  }
);
