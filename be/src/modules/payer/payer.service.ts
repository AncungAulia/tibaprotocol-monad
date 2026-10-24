import type { Address } from "viem"
import { env } from "../../config/env.js"
import { setCreditLimit } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { logger } from "../../lib/logger.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { CompanyRow } from "../../types/db.js"
import { getCompany, requireRole } from "../profile/profile.service.js"
import type { SubmitCompanyInput } from "./payer.schema.js"

export interface SubmitResult {
  company: CompanyRow
  txHash: string | null
}

/**
 * Saves the payer's company details. With DEMO_AUTO_APPROVE the company is approved at once and
 * the admin key sets the on-chain credit limit (testnet only).
 */
export async function submitCompany(address: Address, input: SubmitCompanyInput): Promise<SubmitResult> {
  await requireRole(address, "payer")

  const existing = await getCompany(address)
  if (existing?.review_status === "approved") {
    // Approved details are locked; nothing more to do.
    return { company: existing, txHash: existing.credit_limit_tx }
  }

  const saved = unwrap(
    await supabase
      .from("companies")
      .upsert(
        {
          payer_address: address,
          company_name: input.companyName,
          registration_no: input.registrationNo,
          country: input.country,
          province: input.province,
          city: input.city,
          street: input.street,
          postal_code: input.postalCode,
          contact_name: input.contactName,
          contact_role: input.contactRole ?? null,
          phone_e164: input.phone,
          trips_per_month: input.tripsPerMonth,
          spend_per_month: input.spendPerMonth,
          review_status: "in_review",
          review_note: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "payer_address" },
      )
      .select("*")
      .single<CompanyRow>(),
    "submitCompany",
  )

  if (!env.DEMO_AUTO_APPROVE) return { company: saved, txHash: null }
  return approveCompany(address)
}

const approving = new Map<string, Promise<SubmitResult>>()

/** Demo approval: the admin key sets the on-chain credit limit, then the company is marked approved. */
function approveCompany(address: Address): Promise<SubmitResult> {
  const key = address.toLowerCase()
  const running = approving.get(key)
  if (running) return running
  const job = (async () => {
    const limit = env.DEMO_CREDIT_LIMIT_USDC
    let txHash: string
    try {
      txHash = await setCreditLimit(address, limit)
    } catch (err) {
      if (err instanceof HttpError) throw err
      logger.error({ err, payer: address }, "setCreditLimit failed")
      throw new HttpError(
        502,
        "approval_failed",
        "We saved your company details, but could not set your credit limit yet. Please submit again in a minute.",
      )
    }

    const company = unwrap(
      await supabase
        .from("companies")
        .update({
          review_status: "approved",
          credit_limit: limit,
          credit_limit_tx: txHash,
          updated_at: new Date().toISOString(),
        })
        .eq("payer_address", address)
        .select("*")
        .single<CompanyRow>(),
      "approveCompany",
    )
    return { company, txHash }
  })().finally(() => approving.delete(key))
  approving.set(key, job)
  return job
}

/**
 * The payer's company. In the demo a company left "in review" by a failed approval is approved
 * again here, so "Check status" recovers instead of waiting forever.
 */
export async function getCompanyStatus(address: Address): Promise<CompanyRow | null> {
  await requireRole(address, "payer")
  const company = await getCompany(address)
  if (!company || company.review_status !== "in_review" || !env.DEMO_AUTO_APPROVE) return company
  try {
    return (await approveCompany(address)).company
  } catch (err) {
    logger.warn({ err, payer: address }, "automatic approval retry failed")
    return company
  }
}
