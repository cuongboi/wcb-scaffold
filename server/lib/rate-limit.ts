const windows = new Map<string, { count: number; resetAt: number }>()

/** In-memory fixed window, so limits are per process. Returns false once `key` exceeds `limit`. */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = windows.get(key)
  if (!current || current.resetAt <= now) {
    // Expired entries are only dropped here, which keeps the map bounded without a timer.
    if (windows.size > 10_000)
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  current.count += 1
  return current.count <= limit
}
