import { cn } from "@/lib/utils"

const TICKS = { sm: 40, lg: 16 }

/**
 * Progress shown as slanted bars (the logo shape): 40 thin bars, or 16 thick ones with a legend for `lg`.
 * The leading bar is marigold; over 90% filled bars turn warning (PRD PAY-2); over 100% danger.
 * Bars share the row width, so the meter scales down to any container without overflowing.
 */
export function FanMeter({
  value,
  label,
  size = "sm",
  legend = ["In use", "Free"],
  className,
}: {
  value: number
  label: string
  size?: "sm" | "lg"
  /** Legend labels for the filled and empty bars, shown with `lg` only. */
  legend?: [string, string]
  className?: string
}) {
  const ticks = TICKS[size]
  const pct = Math.max(0, value)
  const filled = Math.min(ticks, Math.round((pct / 100) * ticks))
  const tone = pct > 100 ? "bg-danger" : pct > 90 ? "bg-warning" : "bg-ink"
  const large = size === "lg"

  const meter = (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.min(100, Math.round(pct))}
      aria-valuetext={`${Math.round(pct)}% used`}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "flex max-w-full",
        // The skew pushes the outer bars sideways, so the large meter keeps a small inset.
        // Packed to the left like the design (16 bars about 22px wide); shrinks on narrow cards.
        large ? "h-11 w-full max-w-[460px] gap-1.5 px-2" : "h-[18px]",
        !large && className,
      )}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const color = i === filled - 1 && pct <= 90 ? "bg-stamp" : tone
        return (
          <span key={i} className="flex h-full min-w-0 flex-1 justify-center">
            <span
              className={cn(
                "relative h-full overflow-hidden rounded-full bg-line-strong",
                large ? "w-full -skew-x-[20deg]" : "w-[3.4px] -skew-x-[27deg]",
              )}
            >
              <span
                className={cn("tiba-meter-fill absolute inset-0", color)}
                data-filled={i < filled}
                style={{
                  clipPath: `inset(0 ${i < filled ? 0 : 100}% 0 0)`,
                  transitionDelay: `${i * (large ? 20 : 8)}ms`,
                }}
              />
            </span>
          </span>
        )
      })}
    </div>
  )

  if (!large) return meter
  return (
    <div className={className}>
      {meter}
      <div aria-hidden className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted-ink">
        <span className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-[2px]", tone)} />
          {legend[0]}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-[2px] bg-line-strong" />
          {legend[1]}
        </span>
      </div>
    </div>
  )
}
