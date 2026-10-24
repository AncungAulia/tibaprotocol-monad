"use client"

import { useEffect, useState } from "react"

/** Current time that refreshes on an interval, so arrival estimates count down. */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
