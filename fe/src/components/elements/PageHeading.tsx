import type { ReactNode } from "react"

/**
 * Title first, description below it. Titles are one color (ink), never two-tone.
 * `text-headline` is 28px on phones and 40px on desktop; long words wrap instead of overflowing.
 */
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-headline font-medium [overflow-wrap:anywhere]">
          {title}
        </h1>
        {description ? <p className="text-body text-muted-ink">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
