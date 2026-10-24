import type { Role } from "@/types/role"

export type PublicProfile = {
  address: string
  role: Role
  name: string | null
  plate: string | null
  company: {
    name: string
    city: string | null
    verified: boolean
    creditLimit: number | null
  } | null
}

const roles: Role[] = ["payer", "carrier", "investor", "warehouse"]

export const roleLabel: Record<Role, string> = {
  payer: "Shipping company",
  carrier: "Truck owner",
  investor: "Investor",
  warehouse: "Warehouse staff",
}

/** Reads GET /api/profile/:address defensively; returns null when the shape is not usable. */
export function parsePublicProfile(data: unknown): PublicProfile | null {
  if (!data || typeof data !== "object") return null
  const value = data as Record<string, unknown>
  if (typeof value.address !== "string" || !roles.includes(value.role as Role)) return null
  const text = (input: unknown) => (typeof input === "string" && input.trim() ? input : null)
  const company =
    value.company && typeof value.company === "object"
      ? (value.company as Record<string, unknown>)
      : null
  return {
    address: value.address,
    role: value.role as Role,
    name: text(value.name),
    plate: text(value.plate),
    company:
      company && text(company.name)
        ? {
            name: text(company.name)!,
            city: text(company.city),
            verified: company.verified === true,
            creditLimit:
              typeof company.creditLimit === "number" && Number.isFinite(company.creditLimit)
                ? company.creditLimit
                : null,
          }
        : null,
  }
}

/** The shareable link for a profile, built from the current site origin. */
export function profileLink(origin: string, address: string) {
  return `${origin}/u/${address}`
}
