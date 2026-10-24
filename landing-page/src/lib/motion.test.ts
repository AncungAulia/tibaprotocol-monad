import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { skipMotion, usePrefersReducedMotion } from "./motion"

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (Element.prototype as Partial<Element>).animate
})

describe("usePrefersReducedMotion", () => {
  it("follows the operating system setting", () => {
    mockReducedMotion(true)
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true)
    mockReducedMotion(false)
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false)
  })
})

describe("skipMotion", () => {
  it("skips without an element, without Element.animate, or with reduced motion", () => {
    mockReducedMotion(false)
    const el = document.createElement("div")
    expect(skipMotion(null)).toBe(true)
    expect(skipMotion(el)).toBe(true)
    Element.prototype.animate = () => ({}) as Animation
    expect(skipMotion(el)).toBe(false)
    mockReducedMotion(true)
    expect(skipMotion(el)).toBe(true)
  })
})
