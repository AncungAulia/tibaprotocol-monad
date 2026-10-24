import { formatUsdc } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Large USDC amount: sans 500, tight tracking, tabular figures.
 * `default`: 32 to 40px, smaller muted unit. `hero`: 32 to 48px following the card width,
 * unit at full size in the parent color so it reads on black, marigold or pink cards.
 * The unit wraps below the number instead of overflowing narrow cards.
 */
export function Amount({
  value,
  size = "default",
  className,
}: {
  value: bigint
  size?: "default" | "hero"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-baseline gap-x-2 font-medium tracking-[-0.035em] tabular-nums",
        size === "hero" ? "text-hero" : "text-amount",
        className,
      )}
    >
      <span className="min-w-0 [overflow-wrap:anywhere]">{formatUsdc(value)}</span>
      <span className={size === "hero" ? undefined : "text-heading tracking-normal text-muted-ink"}>
        USDC
      </span>
    </span>
  )
}
