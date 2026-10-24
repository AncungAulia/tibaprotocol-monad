"use client"

import { ApiError } from "@/lib/api"
import { useApiQuery } from "@/lib/queries"
import type { Company } from "@/lib/types"
import { payerSetupStatus } from "../data/payer-status"

/** Shares the company query with the payer setup screen. */
export function usePayerSetupStatus(enabled: boolean) {
  const company = useApiQuery<{ company: Company | null }, Company | null>(
    "/api/payer/company",
    enabled,
    false,
    (data) => data.company,
  )
  const missing = company.error instanceof ApiError && company.error.status === 404
  const status = payerSetupStatus({
    enabled,
    loading: company.isFetching,
    missing,
    error: !!company.error,
    company: company.data,
  })
  return { status, company }
}
