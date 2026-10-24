import { env } from "../../config/env.js"
import { logger } from "../../lib/logger.js"
import type { LocationRow } from "../../types/db.js"

/** Best-effort REST broadcast: no WebSocket handshake per location and no background channel leak. */
export async function broadcastLocation(
  channelKey: string,
  location: LocationRow,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL.replace(/\/$/, "")}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              topic: `trip:${channelKey}`,
              event: "location",
              private: false,
              payload: {
                lat: location.lat,
                lng: location.lng,
                recordedAt: location.recorded_at,
                source: location.source,
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(750),
      },
    )
    if (!response.ok) {
      logger.warn({ status: response.status }, "location saved but Realtime broadcast failed")
      return false
    }
    return true
  } catch {
    // Never log the topic/key, auth headers, coordinates, or raw credential-bearing HTTP errors.
    logger.warn("location saved but Realtime broadcast was unavailable")
    return false
  }
}
