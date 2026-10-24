import type { Address } from "viem"
import { HttpError } from "../../lib/http-error.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { CompanyRow, ProfileRow } from "../../types/db.js"
import type { CreateProfileInput } from "./profile.schema.js"

export async function getProfile(address: string): Promise<ProfileRow | null> {
  return unwrap(
    await supabase.from("profiles").select("*").eq("address", address).maybeSingle<ProfileRow>(),
    "getProfile",
  )
}

export async function getCompany(address: string): Promise<CompanyRow | null> {
  return unwrap(
    await supabase
      .from("companies")
      .select("*")
      .eq("payer_address", address)
      .maybeSingle<CompanyRow>(),
    "getCompany",
  )
}

export async function getMe(address: Address) {
  const profile = await getProfile(address)
  const company = profile?.role === "payer" ? await getCompany(address) : null
  return { address, profile, company }
}

/** Throws unless the wallet has finished setup with the given role. */
export async function requireRole(address: string, role: ProfileRow["role"]): Promise<ProfileRow> {
  const profile = await getProfile(address)
  if (!profile) throw HttpError.forbidden("Please finish setting up your account first.")
  if (profile.role !== role) {
    throw HttpError.forbidden(`Only a ${role} account can do this.`)
  }
  return profile
}

/**
 * Creates the profile for a wallet. One wallet has one role, locked after setup:
 * calling again with the same role updates the basic details, a different role is refused.
 */
export async function saveProfile(
  address: Address,
  input: CreateProfileInput,
  fallbackEmail: string | null,
) {
  const existing = await getProfile(address)
  if (existing && existing.role !== input.role) {
    throw HttpError.conflict(
      `This wallet is already set up as a ${existing.role}. Use another wallet for a different role.`,
    )
  }

  const row = {
    address,
    role: input.role,
    name: input.name ?? null,
    phone_e164: "phone" in input ? (input.phone ?? null) : null,
    email: ("email" in input ? input.email : undefined) ?? fallbackEmail ?? null,
    plate: input.role === "carrier" ? input.plate.replace(/\s+/g, " ") : null,
  }

  const result = await supabase
    .rpc("save_profile", {
      p_address: row.address,
      p_role: row.role,
      p_name: row.name,
      p_phone: row.phone_e164,
      p_email: row.email,
      p_plate: row.plate,
    })
    .single<ProfileRow>()
  if (result.error?.code === "P0001" && result.error.message === "role_conflict") {
    throw HttpError.conflict("This wallet already has a different role. Use another wallet.")
  }
  return unwrap<ProfileRow>(result, "saveProfile")
}

/** Public card for share links (no phone or email). */
export async function getPublicProfile(address: Address) {
  const profile = await getProfile(address)
  if (!profile) throw HttpError.notFound("We could not find this profile.")
  const company = profile.role === "payer" ? await getCompany(address) : null
  return {
    address: profile.address,
    role: profile.role,
    name: profile.name,
    plate: profile.plate,
    company: company
      ? {
          name: company.company_name,
          city: company.city,
          verified: company.review_status === "approved",
          creditLimit: company.credit_limit,
        }
      : null,
  }
}
