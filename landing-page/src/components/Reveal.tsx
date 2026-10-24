"use client"

import { useLayoutEffect, useRef } from "react"
import { skipMotion } from "@/lib/motion"

// Fades its children in and up 24 px the first time they scroll into view. The server HTML has
// no hidden state: the block is only hidden once the script runs (data-reveal, globals.css), so
// without JS, and with reduced motion, it is simply there.
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: "div" | "li" | "article"
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (skipMotion(el)) return

    el.dataset.reveal = "wait"
    let anim: Animation | undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        anim = el.animate(
          [
            { opacity: 0, transform: "translateY(24px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 700, delay, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" },
        )
        delete el.dataset.reveal
      },
      { rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      anim?.cancel()
      delete el.dataset.reveal
    }
  }, [delay])

  return (
    <Tag ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>} className={className}>
      {children}
    </Tag>
  )
}
