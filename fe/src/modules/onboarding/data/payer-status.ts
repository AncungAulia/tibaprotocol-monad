import type { Company } from "@/lib/types"

export type PayerSetupStatus = "idle" | "loading" | "ready" | "setup" | "error"

/** Where a signed-in payer belongs: the dashboard only once the company is approved. */
export function payerSetupStatus(query: {
  enabled: boolean
  loading: boolean
  missing: boolean
  error: boolean
  company: Company | null | undefined
}): PayerSetupStatus {
  if (!query.enabled) return "idle"
  if (query.company?.review_status === "approved") return "ready"
  // Wait for a fresh answer so a cached "in review" does not bounce an approved payer.
  if (query.loading) return "loading"
  if (query.missing) return "setup"
  if (query.error) return "error"
  if (query.company === undefined) return "loading"
  return "setup"
}
