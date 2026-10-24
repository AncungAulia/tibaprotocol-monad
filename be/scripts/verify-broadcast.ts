// Live transport check on an isolated random topic. No trip/location rows are written.
import { existsSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

async function main() {
  for (const file of ["../.env", "../../fe/.env.local", "../../fe/.env"]) {
    const path = fileURLToPath(new URL(file, import.meta.url))
    if (existsSync(path)) process.loadEnvFile(path)
  }
  const url = process.env.SUPABASE_URL
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anon)
    throw new Error("Configure Supabase URL and the frontend's anon/publishable key first.")
  const { broadcastLocation } = await import("../src/modules/locations/location-broadcast.js")
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const key = randomBytes(16).toString("hex")
  const channel = client.channel(`trip:${key}`)
  const row = {
    id: 0,
    shipment_id: 0,
    lat: 0,
    lng: 0,
    recorded_at: new Date().toISOString(),
    source: "gps" as const,
  }
  let started = 0
  let resolveMessage: (value: { payload: unknown; elapsedMs: number }) => void = () => undefined
  let rejectMessage: (reason: Error) => void = () => undefined
  const received = new Promise<{ payload: unknown; elapsedMs: number }>((resolve, reject) => {
    resolveMessage = resolve
    rejectMessage = reject
  })
  void received.catch(() => undefined)
  channel.on("broadcast", { event: "location" }, ({ payload }) =>
    resolveMessage({ payload, elapsedMs: performance.now() - started }),
  )
  let messageTimeout: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime subscription timed out.")), 10000)
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout)
          resolve()
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout)
          reject(new Error("Realtime subscription failed."))
        }
      })
    })
    started = performance.now()
    messageTimeout = setTimeout(
      () => rejectMessage(new Error("No location broadcast received within 5 seconds.")),
      5000,
    )
    const sent = await broadcastLocation(key, row)
    if (!sent) throw new Error("REST broadcast failed or exceeded the 750ms send deadline.")
    const result = await received
    const expected = { lat: row.lat, lng: row.lng, recordedAt: row.recorded_at, source: row.source }
    const payload = result.payload as Record<string, unknown>
    const matches = Object.entries(expected).every(([key, value]) => payload?.[key] === value)
    console.log(
      JSON.stringify({
        check: "realtime-location-broadcast",
        received: matches,
        elapsedMs: Math.round(result.elapsedMs),
        withinOneSecond: result.elapsedMs < 1000,
      }),
    )
    if (!matches || result.elapsedMs >= 1000) process.exitCode = 1
  } finally {
    if (messageTimeout) clearTimeout(messageTimeout)
    await client.removeChannel(channel)
    client.realtime.disconnect()
  }
}
main().catch(() => {
  console.error(
    "Broadcast verification failed. Check Supabase Realtime public channel access and connectivity.",
  )
  process.exitCode = 1
})
