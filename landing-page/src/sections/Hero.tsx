/* eslint-disable @next/next/no-img-element -- static export, pre-compressed WebP */
import { ButtonLink } from "@/components/Button"
import { Wordmark } from "@/components/Logo"
import { ScrollLift } from "@/components/ScrollLift"
import { Title } from "@/components/Title"
import { landing } from "@/content/landing"
import { APP_URL } from "@/lib/env"

// Landing v2 / Hero. Tablet and desktop: the diorama fills the card, a canvas-grey fade on the
// left keeps the words readable, and a faint giant "tiba" sits behind them. Phone: the scene
// on top, cropped to its right side (the truck at the warehouse), the words underneath.
// The scene drifts down slower than the page as it scrolls away (ScrollLift); everything here
// builds itself from the server HTML with CSS, so nothing waits for JS.
export function Hero() {
  const h = landing.hero
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto max-w-[1440px] px-4 pt-3 md:px-8 md:pt-3.5 lg:px-10 lg:pt-4"
    >
      <div className="relative flex flex-col overflow-hidden rounded-[28px] bg-surface-3 md:block md:h-[clamp(560px,calc(100svh-128px),680px)] md:rounded-[36px] lg:h-[clamp(600px,calc(100svh-140px),800px)] lg:rounded-[40px]">
        <div className="relative h-[300px] overflow-hidden md:absolute md:inset-0 md:h-auto">
          <ScrollLift
            from={0}
            to={5}
            start="top top"
            className="absolute inset-x-0 -top-[6%] bottom-0"
          >
            <img
              src={h.image}
              alt={h.alt}
              width={1408}
              height={768}
              fetchPriority="high"
              className="scene-settle-now size-full object-cover object-right md:object-center"
            />
          </ScrollLift>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[68%] bg-linear-to-r from-[#EDEDEDF2] via-[#EDEDEDCC] via-55% to-[#EDEDED00] md:block lg:w-[60%]"
        />
        <Wordmark className="pointer-events-none absolute top-2.5 left-7 hidden h-auto w-[490px] opacity-[0.04] md:block lg:top-2 lg:left-10 lg:w-[clamp(560px,48vw,690px)]" />

        <div className="relative flex flex-col gap-5 px-5 pt-2 pb-6 md:absolute md:bottom-3 md:left-9 md:gap-7 md:p-0 lg:bottom-[30px] lg:left-12 lg:gap-10">
          <Title
            as="h1"
            id="hero-title"
            size="hero"
            line1={h.line1}
            line2={h.line2}
            onLoad
            delay={150}
          />
          <div className="fade-up-now flex flex-col gap-5 [animation-delay:750ms] md:w-[420px] md:gap-[18px] lg:w-[470px] lg:gap-5">
            <p className="text-[16px] leading-normal text-ink-2 lg:text-[17px]">{h.body}</p>
            <div className="flex flex-col gap-2.5 md:flex-row">
              <ButtonLink href={APP_URL} block>
                {h.primary}
              </ButtonLink>
              <ButtonLink href="#how" variant="secondary" icon="down" block>
                {h.secondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
