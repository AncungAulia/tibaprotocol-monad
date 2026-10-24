import { afterEach, describe, expect, it, vi } from "vitest"
import { lockScroll, setSmoothScroller } from "./scroll"

afterEach(() => setSmoothScroller(null))

describe("lockScroll", () => {
  it("hides body overflow and gives back what was there", () => {
    document.body.style.overflow = "auto"
    const unlock = lockScroll()
    expect(document.body.style.overflow).toBe("hidden")
    unlock()
    expect(document.body.style.overflow).toBe("auto")
    document.body.style.overflow = ""
  })

  it("also pauses smooth scrolling, which ignores body overflow", () => {
    const lenis = { stop: vi.fn(), start: vi.fn() }
    setSmoothScroller(lenis)
    const unlock = lockScroll()
    expect(lenis.stop).toHaveBeenCalledOnce()
    unlock()
    expect(lenis.start).toHaveBeenCalledOnce()
  })
})
