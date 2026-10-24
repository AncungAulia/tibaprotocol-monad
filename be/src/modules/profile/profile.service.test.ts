import { describe, expect, it, vi } from "vitest"

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("../../lib/supabase.js", async () => {
  const { createClient } = await import("@supabase/supabase-js")
  return {
    supabase: createClient("https://db.invalid", "service-role", {
      global: { fetch: transport.fetch },
      auth: { persistSession: false },
    }),
    unwrap: (result: { data: unknown; error?: unknown }) => {
      if (result.error) throw result.error
      return result.data
    },
  }
})
const { saveProfile } = await import("./profile.service.js")
describe("Supabase profile RPC response", () => {
  it("requests a single composite row instead of returning a row array to the frontend", async () => {
    const address = "0x1111111111111111111111111111111111111111"
    const row = {
      address,
      role: "carrier",
      name: "Budi",
      phone_e164: "+6281234567890",
      plate: "AB 1234 CD",
      email: null,
    }
    transport.fetch.mockImplementation(
      async (url: string | URL | Request, options: RequestInit) => {
        if (String(url).includes("/rpc/save_profile")) {
          expect(new Headers(options.headers).get("accept")).toBe(
            "application/vnd.pgrst.object+json",
          )
          expect(JSON.parse(String(options.body))).toMatchObject({
            p_address: address,
            p_role: "carrier",
            p_phone: row.phone_e164,
          })
          return new Response(JSON.stringify(row), {
            headers: { "content-type": "application/json" },
          })
        }
        return new Response("[]", { headers: { "content-type": "application/json" } })
      },
    )
    expect(
      await saveProfile(
        address,
        { role: "carrier", name: "Budi", phone: row.phone_e164, plate: row.plate },
        null,
      ),
    ).toEqual(row)
    expect(transport.fetch).toHaveBeenCalledTimes(2)
  })
})
