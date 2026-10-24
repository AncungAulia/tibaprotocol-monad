"use client"

import { useLayoutEffect, useRef } from "react"
import { skipMotion } from "@/lib/motion"

const MOTIONS = {
  // The route pins: pop out of the map with an overshoot.
  pop: {
    keyframes: [
      { opacity: 0, transform: "scale(0.3)" },
      { opacity: 1, transform: "none" },
    ],
    duration: 600,
    easing: "cubic-bezier(0.34, 1.3, 0.64, 1)",
  },
  // The steps and other rows: rise 16 px.
  rise: {
    keyframes: [
      { opacity: 0, transform: "translateY(16px)" },
      { opacity: 1, transform: "none" },
    ],
    duration: 700,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
} satisfies Record<string, { keyframes: Keyframe[]; duration: number; easing: string }>

// Plays one motion on every descendant marked `data-stagger`, one after another, the first time
// the group scrolls into view. Only items on screen count, so a pin hidden on phones does not
// leave a gap in the rhythm. Without JS, and with reduced motion, every item is simply there.
export function Stagger({
  children,
  className,
  motion = "rise",
  step = 90,
  delay = 0,
  threshold = 0.25,
}: {
  children: React.ReactNode
  className?: string
  motion?: keyof typeof MOTIONS
  step?: number
  delay?: number
  threshold?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (skipMotion(el)) return

    el.dataset.staggerWait = ""
    const anims: Animation[] = []
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const { keyframes, duration, easing } = MOTIONS[motion]
        ;[...el.querySelectorAll<HTMLElement>("[data-stagger]")]
          .filter((item) => item.getClientRects().length > 0)
          .forEach((item, i) =>
            anims.push(
              item.animate(keyframes, {
                duration,
                easing,
                delay: delay + i * step,
                fill: "backwards",
              }),
            ),
          )
        delete el.dataset.staggerWait
      },
      { threshold },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      anims.forEach((a) => a.cancel())
      delete el.dataset.staggerWait
    }
  }, [motion, step, delay, threshold])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
