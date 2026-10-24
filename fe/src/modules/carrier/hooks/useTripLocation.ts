"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { api } from "@/lib/api"
import { locationRequest } from "@/lib/requests"
import { errorMessage } from "@/lib/validation"

export function useTripLocation(id: string, enabled: boolean) {
  const { address, getAccessToken } = useAuth()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!enabled || !address) return
    if (!navigator.geolocation) {
      setError("Location is unavailable on this device. You can continue your trip.")
      return
    }
    let lastSent = 0,
      sending = false,
      stopped = false
    const controller = new AbortController()
    const watch = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        if (stopped || sending || Date.now() - lastSent < 30000) return
        sending = true
        lastSent = Date.now()
        try {
          const token = await getAccessToken()
          if (stopped) return
          await api("/api/locations", {
            method: "POST",
            token,
            walletAddress: address,
            signal: controller.signal,
            body: locationRequest(id, coords.latitude, coords.longitude, new Date().toISOString()),
          })
          if (!stopped) setError(undefined)
        } catch (cause) {
          if (!stopped) setError(`Location paused: ${errorMessage(cause)}`)
        } finally {
          sending = false
        }
      },
      () => {
        if (!stopped)
          setError(
            "Location permission is unavailable. Allow location in your browser settings to share your trip.",
          )
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return () => {
      stopped = true
      controller.abort()
      navigator.geolocation.clearWatch(watch)
    }
  }, [id, enabled, address, getAccessToken])
  return error
}
