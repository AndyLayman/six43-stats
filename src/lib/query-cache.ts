interface CacheEntry {
  data: unknown;
  timestamp: number;
  /** When true, the next cachedQuery call for this key forces a refetch
   *  even if the entry is still within TTL. If the refetch fails, the
   *  entry is still kept as a stale-fallback. Set by invalidateCache. */
  stale?: boolean;
}

const cache = new Map<string, CacheEntry>();
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
 * Cached Supabase query wrapper. Returns cached data instantly if fresh,
 * otherwise fetches. On fetch failure (including timeout) returns any
 * cached data we still have — even if expired or marked stale — in
 * preference to leaving the page with no data at all.
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

  const result = await withTimeout(queryFn(), QUERY_TIMEOUT_MS);
  if (!result.error && result.data) {
    cache.set(key, { data: result.data, timestamp: Date.now() });
    return { data: result.data as T, error: null };
  }

  // Query failed or timed out — prefer stale cached data over an empty page
  if (cached) {
    return { data: cached.data as T, error: null };
  }
  return { data: null, error: result.error };
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
