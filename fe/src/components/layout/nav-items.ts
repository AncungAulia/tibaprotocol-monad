import {
  ArrowDownToLine,
  Building2,
  History,
  House,
  Network,
  Package,
  PiggyBank,
  ScanLine,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "@/types/role"

export type NavItem = { label: string; href: string; icon: LucideIcon }

export const navItems: Record<Role, NavItem[]> = {
  payer: [
    { label: "Home", href: "/payer", icon: House },
    { label: "Shipments", href: "/payer/shipments", icon: Package },
    { label: "Network", href: "/payer/network", icon: Network },
  ],
  carrier: [
    { label: "Trips", href: "/carrier", icon: Truck },
    { label: "Payouts", href: "/carrier/payouts", icon: ArrowDownToLine },
    { label: "Companies", href: "/carrier/companies", icon: Building2 },
  ],
  investor: [
    { label: "Pool", href: "/pool", icon: PiggyBank },
    { label: "Deliveries", href: "/pool/deliveries", icon: Package },
    { label: "History", href: "/pool/history", icon: History },
  ],
  warehouse: [
    { label: "Arrivals", href: "/warehouse", icon: Warehouse },
    { label: "Scan", href: "/warehouse/scan", icon: ScanLine },
    { label: "History", href: "/warehouse/history", icon: History },
  ],
}

/**
 * The nav item for a path: the longest href that equals it or is a parent of it, so
 * `/payer/shipments/12` picks Shipments and the role home only wins when nothing deeper matches.
 */
export function activeNavHref(pathname: string, items: NavItem[]) {
  let best: string | undefined
  for (const { href } of items)
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > (best?.length ?? -1))
      best = href
  return best
}
