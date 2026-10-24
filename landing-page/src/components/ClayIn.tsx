"use client"

import { useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/cn"
import { skipMotion } from "@/lib/motion"

// The renders are still images, so they get their life from transforms: the first time one
// scrolls into view it rises and settles with a little bounce. With reduced motion, or without
// JS, it is simply there (the hidden state is set by the script, globals.css).
export function ClayIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (skipMotion(el)) return

    el.dataset.clay = "wait"
    let anim: Animation | undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        anim = el.animate(
          [
            { opacity: 0, transform: "translateY(32px) scale(0.96)" },
            { opacity: 1, transform: "none" },
          ],
          // A small overshoot, so the object lands rather than stops.
          { duration: 900, delay, easing: "cubic-bezier(0.34, 1.36, 0.64, 1)", fill: "backwards" },
        )
        delete el.dataset.clay
      },
      { rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      anim?.cancel()
      delete el.dataset.clay
    }
  }, [delay])

  return (
    <div ref={ref} className={cn("relative", className)}>
      {children}
    </div>
  )
}
