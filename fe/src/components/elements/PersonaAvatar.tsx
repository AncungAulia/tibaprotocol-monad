import type { Role } from "@/types/role"
import { cn } from "@/lib/utils"

/**
 * Gender-neutral role avatar for the signed-in user (navbar, mobile header, wallet menu).
 * Other people in lists keep initials, so they stay easy to tell apart.
 */
export function PersonaAvatar({ role, size = 40, className }: { role: Role; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/illustrations/avatar-${role}.svg`}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full", className)}
    />
  )
}

export function Initials({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("")
  return (
    <span
      style={{ width: size, height: size }}
      className={cn("grid shrink-0 place-items-center rounded-full bg-subtle text-[14px] font-semibold", className)}
    >
      {letters}
    </span>
  )
}
