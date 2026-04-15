import { supabase } from "./supabase";

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 30_000; // 30 seconds

/**
 * Cached Supabase query wrapper. Returns cached data instantly if fresh,
 * otherwise fetches and caches the result.
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => ReturnType<typeof supabase.from>,
  ttl = DEFAULT_TTL
): Promise<{ data: T | null; error: unknown }> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return { data: cached.data as T, error: null };
  }

  const result = await queryFn();
  if (!result.error && result.data) {
    cache.set(key, { data: result.data, timestamp: Date.now() });
  }
  return { data: result.data as T, error: result.error };
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
