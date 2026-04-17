interface CacheEntry {
  data: unknown;
  timestamp: number;
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
 * otherwise fetches and caches the result.
 */
export async function cachedQuery<T>(
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: () => PromiseLike<{ data: any; error: any }>,
  ttl = DEFAULT_TTL
): Promise<{ data: T | null; error: { message: string } | null }> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return { data: cached.data as T, error: null };
  }

  const result = await withTimeout(queryFn(), QUERY_TIMEOUT_MS);
  if (!result.error && result.data) {
    cache.set(key, { data: result.data, timestamp: Date.now() });
    return { data: result.data as T, error: null };
  }

  // Query failed or timed out. Prefer any cached data (even expired) over
  // surfacing an empty page — the user almost always wants to see the
  // last-known-good data while we recover in the background.
  if (cached) {
    return { data: cached.data as T, error: null };
  }
  return { data: null, error: result.error };
}

/** Invalidate a specific cache key or all keys matching a prefix */
export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix + ":")) {
      cache.delete(key);
    }
  }
}
