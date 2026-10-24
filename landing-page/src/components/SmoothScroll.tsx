"use client"

import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"
import { useEffect } from "react"
import { usePrefersReducedMotion } from "@/lib/motion"
import { setSmoothScroller } from "@/lib/scroll"

gsap.registerPlugin(ScrollTrigger)

// Lenis smooth scroll on wheel and trackpad, driven by GSAP's ticker so ScrollTrigger and Lenis
// read the same position every frame. Touch keeps the phone's own scroll (syncTouch off), and
// reduced motion keeps the browser's scroll entirely.
export function SmoothScroll() {
  const reduced = usePrefersReducedMotion()

  // A reload always starts at the hero, not where the browser last left off.
  useEffect(() => {
    history.scrollRestoration = "manual"
    if (location.hash) history.replaceState(null, "", location.pathname + location.search)
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [])

  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({ autoRaf: false, anchors: { offset: -96 }, lerp: 0.1 })
    const tick = (time: number) => lenis.raf(time * 1000)
    lenis.on("scroll", ScrollTrigger.update)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    lenis.scrollTo(0, { immediate: true, force: true })
    setSmoothScroller(lenis)
    return () => {
      setSmoothScroller(null)
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [reduced])

  return null
}
