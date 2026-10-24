export type Role = "payer" | "carrier" | "investor" | "warehouse"

export const roleHome: Record<Role, string> = {
  payer: "/payer",
  carrier: "/carrier",
  investor: "/pool",
  warehouse: "/warehouse",
}
