import { describe, expect, it, vi } from "vitest"

vi.mock("../../lib/chain.js", () => ({
  sameAddress: (a?: string | null, b?: string | null) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase(),
}))

const { generateInviteToken, inviteState, inviteUrl, INVITE_TTL_MS } = await import(
  "./invites.service.js"
)

describe("invite helpers", () => {
  it("generates 16-character URL-safe tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateInviteToken))
    expect(tokens.size).toBe(200)
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{16}$/)
  })

  it("builds the join URL from APP_URL", () => {
    expect(inviteUrl("abc123")).toBe("https://app.tibaprotocol.xyz/join/abc123")
  })

  it("expires after 7 days", () => {
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it("reports valid, expired and used states", () => {
    const now = Date.parse("2026-10-24T10:00:00Z")
    expect(inviteState({ used_by: null, expires_at: "2026-10-25T10:00:00Z" }, now)).toBe("valid")
    expect(inviteState({ used_by: null, expires_at: "2026-10-24T09:59:59Z" }, now)).toBe("expired")
    expect(inviteState({ used_by: "0xabc", expires_at: "2026-10-25T10:00:00Z" }, now)).toBe("used")
  })
})
