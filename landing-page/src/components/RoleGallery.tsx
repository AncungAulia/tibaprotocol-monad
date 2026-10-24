"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"

// The role cards' container. Phones: a horizontal carousel that snaps card by card and runs to
// the screen edge, with dots under it that follow the scroll. Tablets: two by two. Desktop: four
// across, bottom-aligned, so the different card heights read as a staggered row.
export function RoleGallery({
  children,
  count,
  label,
}: {
  children: React.ReactNode
  count: number
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const card = el.firstElementChild as HTMLElement | null
      if (!card) return
      const max = el.scrollWidth - el.clientWidth
      // At the end of the track the last card cannot reach the left edge; count it as shown.
      const i =
        el.scrollLeft >= max - 2 ? count - 1 : Math.round(el.scrollLeft / (card.offsetWidth + 12))
      setActive(Math.min(count - 1, Math.max(0, i)))
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [count])

  return (
    <div className="flex flex-col gap-7">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-x-4 md:gap-y-10 md:overflow-visible md:px-0 lg:flex lg:items-end lg:gap-4"
      >
        {children}
      </div>
      <div aria-hidden className="flex items-center gap-1.5 md:hidden">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out",
              i === active ? "w-5 bg-ink" : "w-1.5 bg-line-strong",
            )}
          />
        ))}
      </div>
    </div>
  )
}
