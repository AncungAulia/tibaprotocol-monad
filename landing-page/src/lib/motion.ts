"use client"

import { useSyncExternalStore } from "react"

const REDUCED = "(prefers-reduced-motion: reduce)"

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

// True when the visitor asked for less motion. On the server it is false; the page renders
// the same HTML either way and only the motion differs.
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  )
}

// For effects that run once on mount: true when motion should be skipped, either because the
// visitor asked for less of it or because the browser cannot animate elements (old browsers,
// tests without Element.animate).
export function skipMotion(el: Element | null): el is null {
  if (!el || typeof el.animate !== "function") return true
  return window.matchMedia(REDUCED).matches
}
