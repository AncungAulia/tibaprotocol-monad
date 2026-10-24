/* eslint-disable @next/next/no-img-element -- static export, pre-compressed WebP */
import { ButtonLink } from "@/components/Button"
import { ClayIn } from "@/components/ClayIn"
import { Logo, Wordmark } from "@/components/Logo"
import { Reveal } from "@/components/Reveal"
import { Title } from "@/components/Title"
import { landing } from "@/content/landing"
import { APP_URL, GITHUB_URL, X_URL } from "@/lib/env"

// Landing v2 / Footer, top half: the marigold closing card with the coin render. Phones put
// the render under the words; wider frames put it on the right, blended into the marigold.
export function Closing() {
  const c = landing.closing
  return (
    <section
      aria-labelledby="closing-title"
      className="mx-auto max-w-[1440px] px-4 pt-[72px] md:px-8 md:pt-24 lg:px-10 lg:pt-[120px]"
    >
      <div className="flex flex-col overflow-hidden rounded-[28px] bg-marigold md:h-[440px] md:flex-row md:rounded-[36px] lg:h-[520px] lg:rounded-[40px]">
        <div className="flex flex-col gap-6 px-6 pt-9 pb-2 md:w-[420px] md:shrink-0 md:justify-between md:py-12 md:pr-0 md:pl-11 lg:w-[min(640px,55%)] lg:py-16 lg:pl-[72px]">
          <div className="flex flex-col gap-6 md:gap-5 lg:gap-6">
            <Title
              id="closing-title"
              size="closing"
              line1={c.line1}
              line2={c.line2}
              className="md:max-w-[370px] lg:max-w-none"
            />
            <Reveal>
              <p className="text-[16px] leading-normal text-ink/80 lg:max-w-[480px] lg:text-[18px]">
                {c.body}
              </p>
            </Reveal>
          </div>
          <ButtonLink href={APP_URL} block>
            {c.cta}
          </ButtonLink>
        </div>
        <ClayIn className="h-[260px] md:h-auto md:min-w-0 md:flex-1">
          <img
            src={c.image}
            alt={c.alt}
            width={1408}
            height={768}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 hidden w-[140px] bg-linear-to-r from-marigold to-[#FFC21A00] md:block lg:w-[220px]"
          />
        </ClayIn>
      </div>
    </section>
  )
}

const linkClass =
  "w-fit rounded-md text-[15px] leading-tight font-medium text-ink transition-colors hover:text-ink-2 lg:text-[16px]"

// Landing v2 / Footer, the white site footer: tagline, link columns, the testnet line and a
// giant "tiba" that always shows whole (it is sized to the card's width, never cropped).
export function SiteFooter() {
  const f = landing.footer
  return (
    <footer className="mx-auto max-w-[1440px] px-4 pt-4 pb-4 md:px-8 md:pt-5 md:pb-6 lg:px-10 lg:pt-10 lg:pb-16">
      <div className="flex flex-col gap-8 rounded-[28px] bg-surface px-6 pt-8 pb-5 md:gap-10 md:rounded-[36px] md:px-10 md:pt-11 md:pb-8 lg:gap-14 lg:rounded-[40px] lg:px-14 lg:pt-14 lg:pb-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between md:gap-8">
          <div className="flex flex-col gap-3 md:w-[300px] md:gap-3.5 lg:w-[420px] lg:gap-4">
            <a href="#top" aria-label={landing.nav.home} className="w-fit rounded-md">
              <Logo alt="" className="h-8 w-auto lg:h-[37px]" />
            </a>
            <p className="text-[15px] leading-normal text-ink-2 lg:text-[16px]">{f.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-6 md:flex md:gap-12 lg:gap-24">
            <nav aria-labelledby="footer-product" className="flex flex-col gap-3 lg:gap-3.5">
              <h2 id="footer-product" className="text-[13px] font-normal text-muted lg:text-[14px]">
                {f.product.title}
              </h2>
              <ul className="flex flex-col gap-3 lg:gap-3.5">
                {f.product.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className={linkClass}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-labelledby="footer-build" className="flex flex-col gap-3 lg:gap-3.5">
              <h2 id="footer-build" className="text-[13px] font-normal text-muted lg:text-[14px]">
                {f.build.title}
              </h2>
              <ul className="flex flex-col gap-3 lg:gap-3.5">
                <li>
                  <a href={APP_URL} className={linkClass}>
                    {f.build.app}
                  </a>
                </li>
                <li>
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={linkClass}>
                    {f.build.github}
                  </a>
                </li>
                <li>
                  <a href={X_URL} target="_blank" rel="noreferrer" className={linkClass}>
                    {f.build.x}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4 text-[13px] text-muted md:flex-row md:items-center md:justify-between md:pt-[18px] lg:py-5 lg:text-[14px]">
          <p>{f.legal}</p>
          <p className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            {f.testnet}
          </p>
        </div>

        <Wordmark className="h-auto w-full" />
      </div>
    </footer>
  )
}
