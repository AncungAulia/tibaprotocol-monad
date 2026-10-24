import { afterEach, describe, expect, it, vi } from "vitest"
import { broadcastLocation } from "./location-broadcast.js"
const row = {
  id: 1,
  shipment_id: 1,
  lat: -7,
  lng: 110,
  recorded_at: "2026-10-24T05:10:00.000Z",
  source: "gps" as const,
}
afterEach(() => vi.unstubAllGlobals())
describe("location broadcast REST", () => {
  it("sends the exact FE payload using the server key", async () => {
    const request = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal("fetch", request)
    expect(await broadcastLocation("abc123", row)).toBe(true)
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://example.supabase.co/realtime/v1/api/broadcast")
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-service-role-key")
    expect(JSON.parse(String(init.body))).toEqual({
      messages: [
        {
          topic: "trip:abc123",
          event: "location",
          private: false,
          payload: { lat: -7, lng: 110, recordedAt: row.recorded_at, source: "gps" },
        },
      ],
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it("does not throw on HTTP failure or a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    )
    expect(await broadcastLocation("abc123", row)).toBe(false)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout")
      }),
    )
    expect(await broadcastLocation("abc123", row)).toBe(false)
  })
})
