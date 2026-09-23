// Bounded, process-local protection. Production still needs an edge limiter.
export function createRateLimit({ limit = 600, windowMs = 60000, maxKeys = 10000, now = Date.now } = {}) {
  const buckets = new Map();
  let sweepAt = 0;
  return key => {
    const time = now();
    if (time >= sweepAt) {
      for (const [id, bucket] of buckets) if (time >= bucket.until) buckets.delete(id);
      sweepAt = time + windowMs;
    }
    let bucket = buckets.get(key);
    if (!bucket || time >= bucket.until) {
      if (!bucket && buckets.size >= maxKeys) throw new Error('RATE_LIMITED');
      bucket = { count: 0, until: time + windowMs };
      buckets.set(key, bucket);
    }
    if (++bucket.count > limit) throw new Error('RATE_LIMITED');
  };
}
