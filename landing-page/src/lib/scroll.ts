// One place that knows whether Lenis is running, so a scroll lock (the mobile menu) can pause
// it. Lenis drives the page by itself and ignores `overflow: hidden` on the body.

type SmoothScroller = { stop(): void; start(): void }

let scroller: SmoothScroller | null = null

export function setSmoothScroller(next: SmoothScroller | null) {
  scroller = next
}

// Locks page scroll and returns the function that restores it.
export function lockScroll(): () => void {
  const previous = document.body.style.overflow
  document.body.style.overflow = "hidden"
  scroller?.stop()
  return () => {
    document.body.style.overflow = previous
    scroller?.start()
  }
}
