import { isAddress, type Address } from "viem"
import { roleHome } from "../types/role"
import { api, ApiError } from "./api"
import type { Profile } from "./types"

export async function fetchProfile(
  address: Address,
  token: string | null,
  signal?: AbortSignal,
): Promise<Profile | null> {
  if (!token) throw new ApiError(401, "Your session has ended. Please sign in again.")
  const data = await api<{ address: unknown; profile: unknown }>("/api/profile/me", {
    token,
    walletAddress: address,
    signal,
  })
  if (
    !data ||
    typeof data.address !== "string" ||
    data.address.toLowerCase() !== address.toLowerCase()
  )
    throw new ApiError(502, "We could not verify this account. Please try again.")
  if (data.profile === null) return null
  if (!data.profile || typeof data.profile !== "object")
    throw new ApiError(502, "We could not read your profile. Please try again.")
  const profile = data.profile as Record<string, unknown>
  if (
    typeof profile.address !== "string" ||
    !isAddress(profile.address) ||
    profile.address.toLowerCase() !== address.toLowerCase() ||
    typeof profile.role !== "string" ||
    !Object.hasOwn(roleHome, profile.role) ||
    (profile.name !== null && typeof profile.name !== "string")
  )
    throw new ApiError(502, "We could not read your profile. Please try again.")
  for (const key of ["phone_e164", "email", "plate"]) {
    if (profile[key] !== undefined && profile[key] !== null && typeof profile[key] !== "string")
      throw new ApiError(502, "We could not read your profile. Please try again.")
  }
  return profile as Profile
}
