"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useRef } from "react"
import { usePrefersReducedMotion } from "@/lib/motion"

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Moves its children on y from `from` to `to` (percent of its own height) while it scrolls,
// scrubbed to the scrollbar. By default from when its top enters the screen until its bottom
// leaves; `start` overrides that, so the hero, which is in view at load, starts at the top.
// Used for the parallax of the hero scene. With reduced motion it stays at rest.
export function ScrollLift({
  from,
  to,
  start = "top bottom",
  children,
  className,
}: {
  from: number
  to: number
  start?: string
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useGSAP(
    () => {
      if (reduced || !ref.current) return
      gsap.fromTo(
        ref.current,
        { yPercent: from },
        {
          yPercent: to,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current.parentElement,
            start,
            end: "bottom top",
            scrub: true,
          },
        },
      )
    },
    { dependencies: [reduced, from, to, start], scope: ref, revertOnUpdate: true },
  )

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
