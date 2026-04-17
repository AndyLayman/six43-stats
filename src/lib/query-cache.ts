interface CacheEntry {
  data: unknown;
  timestamp: number;
  /** When true, the next cachedQuery call for this key forces a refetch
   *  even if the entry is still within TTL. If the refetch fails, the
   *  entry is still kept as a stale-fallback. Set by invalidateCache. */
  stale?: boolean;
}

const cache = new Map<string, CacheEntry>();
const pendingQueries = new Set<string>();
const DEFAULT_TTL = 30_000; // 30 seconds
const QUERY_TIMEOUT_MS = 10_000; // iOS Safari can leave fetches pending
                                 // forever after a tab is briefly backgrounded;
                                 // race each query against a timeout so a
                                 // stuck fetch becomes a surfaced error
                                 // instead of a permanent spinner.

function withTimeout<T>(
  p: PromiseLike<{ data: T; error: { message: string } | null }>,
  ms: number
): Promise<{ data: T | null; error: { message: string } | null }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ data: null, error: { message: "Query timed out" } });
    }, ms);
    Promise.resolve(p).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err: unknown) => {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);
        resolve({ data: null, error: { message } });
      }
    );
  });
}

/**
 * Cached Supabase query wrapper. Semantics:
 *   - Fresh cache: return immediately, no network.
 *   - Stale cache (any prior data): return immediately, refresh in
 *     background. This keeps page navigations snappy even when the
 *     underlying fetch is slow or stuck (iOS suspend aftermath).
 *   - No cache at all: await the fetch with a timeout.
 */
export async function cachedQuery<T>(
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: () => PromiseLike<{ data: any; error: any }>,
  ttl = DEFAULT_TTL
): Promise<{ data: T | null; error: { message: string } | null }> {
  const cached = cache.get(key);
  const isFresh = cached && !cached.stale && Date.now() - cached.timestamp < ttl;
  if (isFresh) {
    return { data: cached!.data as T, error: null };
  }

  if (cached) {
    // Stale-while-revalidate: return what we have now, refresh for next time.
    // Fire-and-forget; errors and timeouts are ignored — the current cached
    // value stays in place until a future call succeeds.
    pendingQueries.add(key);
    Promise.resolve(queryFn()).then((result) => {
      if (!result.error && result.data) {
        cache.set(key, { data: result.data, timestamp: Date.now() });
      }
    }).catch(() => { /* keep stale */ }).finally(() => {
      pendingQueries.delete(key);
    });
    return { data: cached.data as T, error: null };
  }

  // First-ever load for this key: no cache to fall back to, must wait.
  pendingQueries.add(key);
  const result = await withTimeout(queryFn(), QUERY_TIMEOUT_MS);
  pendingQueries.delete(key);
  if (!result.error && result.data) {
    cache.set(key, { data: result.data, timestamp: Date.now() });
    return { data: result.data as T, error: null };
  }
  return { data: null, error: result.error };
}

export interface CacheSnapshotEntry {
  key: string;
  ageMs: number;
  stale: boolean;
  pending: boolean;
}

/** Inspect the in-memory cache for debugging. */
export function getCacheSnapshot(): CacheSnapshotEntry[] {
  const now = Date.now();
  const keys = new Set<string>([...cache.keys(), ...pendingQueries]);
  return [...keys].sort().map((key) => {
    const entry = cache.get(key);
    return {
      key,
      ageMs: entry ? now - entry.timestamp : -1,
      stale: !!entry?.stale,
      pending: pendingQueries.has(key),
    };
  });
}

/**
 * Mark entries stale so the next cachedQuery call will refetch. We do NOT
 * delete — if the refetch fails, cachedQuery falls back to the stale copy.
 * Without this, pull-to-refresh + a hung subsequent fetch left the user
 * staring at empty pages.
 */
export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    for (const entry of cache.values()) entry.stale = true;
    return;
  }
  for (const [key, entry] of cache) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix + ":")) {
      entry.stale = true;
    }
  }
}
