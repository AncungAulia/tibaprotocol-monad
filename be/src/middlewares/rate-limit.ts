import type { RequestHandler } from "express"

/** Per-process guard for the demo API. Multi-instance deployments need a shared limiter. */
export function rateLimit(limit: number, windowMs = 60_000): RequestHandler {
  const buckets = new Map<string, { count: number; until: number }>()
  return (req, res, next) => {
    const now = Date.now()
    const key = req.user?.privyId ?? req.ip ?? "unknown"
    let bucket = buckets.get(key)
    if (!bucket || bucket.until <= now) {
      for (const [id, value] of buckets) if (value.until <= now) buckets.delete(id)
      if (buckets.size >= 10000) {
        res
          .status(503)
          .json({
            error: { code: "busy", message: "The service is busy. Please try again shortly." },
          })
        return
      }
      bucket = { count: 0, until: now + windowMs }
      buckets.set(key, bucket)
    }
    if (++bucket.count > limit) {
      res.set("Retry-After", String(Math.ceil((bucket.until - now) / 1000)))
      res
        .status(429)
        .json({
          error: {
            code: "rate_limited",
            message: "Too many requests. Please wait a moment and try again.",
          },
        })
      return
    }
    next()
  }
}
