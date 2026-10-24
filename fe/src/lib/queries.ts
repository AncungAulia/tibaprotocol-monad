"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/providers/AuthProvider"
import { api } from "./api"
import { fetchProfile } from "./profile"
import type { Place, Relation } from "./types"
import { networkRelations, type NetworkResponse } from "./responses"

export function useApiQuery<T, R = T>(
  path: string,
  enabled = true,
  publicAccess = false,
  select?: (data: T) => R,
) {
  const { address, authenticated, getAccessToken } = useAuth()
  return useQuery({
    queryKey: ["api", path, publicAccess ? "public" : address],
    enabled: enabled && (publicAccess || (authenticated && !!address)),
    queryFn: async ({ signal }) =>
      api<T>(path, {
        token: publicAccess ? null : await getAccessToken(),
        walletAddress: publicAccess ? undefined : address,
        signal,
      }),
    retry: false,
    select,
  })
}
export function usePlaces() {
  return useApiQuery<{ places: Place[] }, Place[]>(
    "/api/places",
    true,
    false,
    (data) => data.places,
  )
}
export function useNetwork() {
  const { address } = useAuth()
  return useApiQuery<NetworkResponse, Relation[]>("/api/network", true, false, (data) =>
    networkRelations(data, address!),
  )
}
export function useProfile() {
  const { address, authenticated, getAccessToken } = useAuth()
  return useQuery({
    queryKey: ["profile", address],
    enabled: authenticated && !!address,
    queryFn: async ({ signal }) => fetchProfile(address!, await getAccessToken(), signal),
    retry: false,
  })
}
