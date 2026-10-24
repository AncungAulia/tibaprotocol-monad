import { env } from "./env"
import type { Address } from "viem"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type Options = Omit<RequestInit, "body"> & {
  body?: unknown
  token?: string | null
  walletAddress?: Address
}

/** Calls be/. Pass the Privy access token from usePrivy().getAccessToken(). */
export async function api<T>(
  path: string,
  { body, token, walletAddress, headers, ...init }: Options = {},
): Promise<T> {
  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json")
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`)
  if (walletAddress) requestHeaders.set("X-Wallet-Address", walletAddress)
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") throw error
    throw new ApiError(
      0,
      "We could not reach the service. Please check your connection and try again.",
    )
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : data?.error?.message
    throw new ApiError(
      res.status,
      typeof message === "string" ? message : "Something went wrong. Please try again.",
    )
  }
  return data as T
}
