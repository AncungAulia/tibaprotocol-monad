import { landing } from "@/content/landing"
import { APP_URL } from "@/lib/env"
import { ButtonLink } from "./Button"
import { Logo } from "./Logo"

// The floating white pill from the top of the Landing v2 frames. It stays at the top while the
// page scrolls. Phones keep only the logo and a shorter "Open app"; the sections are a short
// scroll away, so there is no menu. It comes down once on load (CSS, no JS needed).
export function Nav() {
  const n = landing.nav
  return (
    <header className="fade-down-now pointer-events-none sticky top-0 z-40 px-4 pt-3 [animation-delay:500ms] md:px-8 md:pt-4 lg:px-10 lg:pt-5">
      <div className="pointer-events-auto mx-auto flex h-[60px] max-w-[1360px] items-center justify-between gap-4 rounded-full bg-surface pr-1.5 pl-5 md:h-16 md:pr-2 md:pl-[22px] lg:h-[72px] lg:pr-3 lg:pl-7">
        <a href="#top" aria-label={n.home} className="shrink-0 rounded-md">
          <Logo alt="" className="h-8 w-auto lg:h-[37px]" />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-6 md:flex lg:gap-9">
          {n.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md text-[14px] font-medium text-ink-2 transition-colors hover:text-ink lg:text-[15px]"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <ButtonLink href={APP_URL}>
          <span className="md:hidden">{n.ctaShort}</span>
          <span className="hidden md:inline">{n.cta}</span>
        </ButtonLink>
      </div>
    </header>
  )
}
