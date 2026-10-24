import { describe, expect, it } from "vitest"
import { allStrings, landing } from "./landing"

// Acronyms are the only all-caps words allowed (no all-caps labels).
const ACRONYMS = new Set(["TIBA", "USDC", "QR", "EVM"])

describe("landing copy", () => {
  const strings = allStrings(landing)

  it("has copy to check", () => {
    expect(strings.length).toBeGreaterThan(60)
  })

  it.each(strings)("follows the copy rules: %s", (text) => {
    expect(text, "em dash").not.toMatch(/—/)
    expect(text, "en dash").not.toMatch(/–/)
    expect(text, "other currency").not.toMatch(/\$|\bUSD\b|\bUSDT\b|\bdollars?\b|\bIDR\b|\bRp\b/i)
    expect(text, "buzzword").not.toMatch(
      /\b(seamless|unlock|empower|revolutionary|next-gen|trustless|supercharge|effortless|game-changing|leverage)\b/i,
    )
    for (const word of text.match(/\b[A-Z]{2,}\b/g) ?? []) {
      expect(ACRONYMS.has(word), `all caps word "${word}"`).toBe(true)
    }
  })

  it("gives every render a description", () => {
    const renders = [
      landing.hero,
      landing.problem,
      landing.howItWorks,
      ...landing.whoItsFor.roles,
      landing.whyMonad.proof,
      landing.closing,
    ]
    for (const r of renders) {
      expect(r.image).toMatch(/^\/clay\/[a-z-]+\.webp$/)
      expect(r.alt.length).toBeGreaterThan(20)
    }
  })

  it("has five steps, four roles and four facts", () => {
    expect(landing.howItWorks.steps).toHaveLength(5)
    expect(landing.whoItsFor.roles).toHaveLength(4)
    expect(landing.whyMonad.facts).toHaveLength(4)
  })

  it("uses the agreed legal and testnet lines", () => {
    expect(landing.footer.legal).toBe("© 2026 Tiba Protocol")
    expect(landing.footer.testnet).toBe("Live on Monad testnet")
  })
})

describe("allStrings", () => {
  it("collects nested copy and skips links and image paths", () => {
    expect(
      allStrings({
        a: "Hello",
        b: [{ href: "#how", label: "How" }],
        img: "/clay/x.webp",
        url: "https://x.y",
      }),
    ).toEqual(["Hello", "How"])
  })
})
