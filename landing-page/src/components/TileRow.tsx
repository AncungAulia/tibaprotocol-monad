"use client"

import { useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/cn"
import { skipMotion } from "@/lib/motion"

export type Tile = "grey" | "ink" | "marigold" | "empty"

const FILLS: Record<Exclude<Tile, "empty">, string> = {
  grey: "bg-surface-3",
  ink: "bg-ink",
  marigold: "bg-marigold",
}

// One row of the invoice comparison, a day per tile. Filled tiles fill in turn the first time
// the row scrolls into view, `step` ms apart, so a slow row (weeks of waiting) and a fast one
// (paid the same day) read as different speeds. `wideOnly` tiles show only on desktop, where the
// row is longer. Without JS, and with reduced motion, the tiles are simply filled. The tiles
// are decoration: the row's title and meta line say the same in words.
export function TileRow({
  tiles,
  wideOnly = [],
  step,
  delay = 0,
}: {
  tiles: readonly Tile[]
  wideOnly?: readonly number[]
  step: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (skipMotion(el)) return

    el.dataset.tiles = "wait"
    const anims: Animation[] = []
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        ;[...el.querySelectorAll<HTMLElement>("[data-tile-fill]")]
          .filter((fill) => fill.getClientRects().length > 0)
          .forEach((fill, i) =>
            anims.push(
              fill.animate(
                [
                  { opacity: 0, transform: "scale(0.7)" },
                  { opacity: 1, transform: "none" },
                ],
                {
                  duration: 420,
                  delay: delay + i * step,
                  easing: "cubic-bezier(0.25, 1, 0.5, 1)",
                  fill: "backwards",
                },
              ),
            ),
          )
        delete el.dataset.tiles
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      anims.forEach((a) => a.cancel())
      delete el.dataset.tiles
    }
  }, [step, delay])

  return (
    <div ref={ref} aria-hidden className="flex h-[26px] gap-1 md:h-7 lg:h-9 lg:gap-[5px]">
      {tiles.map((tile, i) => (
        <span
          key={i}
          className={cn(
            "relative min-w-0 flex-1 rounded-md border border-line lg:rounded-lg",
            wideOnly.includes(i) && "hidden lg:block",
          )}
        >
          {tile !== "empty" && (
            <span
              data-tile-fill
              className={cn(
                "absolute -inset-px rounded-[inherit] shadow-[0_2px_0_#0000001f]",
                FILLS[tile],
              )}
            />
          )}
        </span>
      ))}
    </div>
  )
}
