// In-memory server-side cache with Time-To-Live (TTL) and instant invalidation
// Eliminates redundant network round-trips to Firestore on every navigation

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<any>>();

/**
 * Retrieve data from in-memory cache if not expired
 */
export function getFromMemoryCache<T>(key: string): T | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store data in in-memory cache with specified TTL in seconds (default 60s)
 */
export function setMemoryCache<T>(key: string, data: T, ttlSeconds: number = 60): void {
  memoryStore.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidate a specific cache key or all keys matching a prefix
 */
export function invalidateMemoryCache(keyOrPrefix: string): void {
  for (const key of memoryStore.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Clear all cached items in memory
 */
export function clearAllMemoryCache(): void {
  memoryStore.clear();
}

