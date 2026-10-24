import { Nav } from "@/components/Nav"
import { Closing, SiteFooter } from "@/sections/ClosingAndFooter"
import { Hero } from "@/sections/Hero"
import { HowItWorks } from "@/sections/HowItWorks"
import { Problem } from "@/sections/Problem"
import { WhoItsFor } from "@/sections/WhoItsFor"
import { WhyMonad } from "@/sections/WhyMonad"

// The page, in the order of the Landing v2 frames.
export default function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <Problem />
        <HowItWorks />
        <WhoItsFor />
        <WhyMonad />
        <Closing />
      </main>
      <SiteFooter />
    </>
  )
}
