# TIBA landing page

The public page for TIBA (Tokenized Invoice Based on Arrival). It explains the product in plain
words and sends people into the app. A static Next.js site: `pnpm build` writes plain files to
`out/`, ready for any static host.

- Design: the Landing v2 frames (Desktop 1440, Tablet 834, Mobile 390) in the TIBA Pencil file.
- Architecture and motion follow `forepay/landing-page` (Next 16, Tailwind v4, GSAP, Lenis),
  without its 3D hero: TIBA's hero is a pre-rendered clay scene with parallax.

## Run

```bash
# from the repo root, once
pnpm install

cd landing-page
pnpm dev          # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm start        # serves out/ after a build
```

## Environment

Optional and public. Copy `.env.example` to `.env.local`, or set them where the page is deployed.

| Name                   | What it is                                       | Without it              |
| ---------------------- | ------------------------------------------------ | ----------------------- |
| `NEXT_PUBLIC_APP_URL`  | Where "Open the app" goes: the deployed TIBA app | `#`                     |
| `NEXT_PUBLIC_SITE_URL` | This page's own URL, for share previews          | `http://localhost:3000` |

GitHub and "Contracts on Monadscan" (the ShipmentManager proxy from
`sc/deployments/10143.json`) are fixed in `src/lib/env.ts`.

## Where things are

| Path                     | What                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/content/landing.ts` | Every word on the page. `landing.test.ts` checks the copy rules (English, no em dash, USDC only, no all-caps labels) and that every render has alt text. |
| `src/sections/`          | One file per section, in page order: `Hero`, `Problem`, `HowItWorks`, `WhoItsFor`, `WhyMonad`, `ClosingAndFooter`.                                       |
| `src/components/`        | Nav, button, logo, title, and the motion pieces below.                                                                                                   |
| `src/lib/type.ts`        | Heading sizes for the three frames, fluid in between.                                                                                                    |
| `public/clay/`           | The clay renders as WebP (1408 wide, all under 50 KB).                                                                                                   |

## Motion and fallbacks

- `SmoothScroll`: Lenis on wheel and trackpad, driven by GSAP's ticker so ScrollTrigger reads the
  same position. Phones keep their own scrolling.
- `RiseText` / `Title`: headline letters rise from under their line. The hero does it with CSS
  straight from the server HTML, so it never flashes.
- `ClayIn`: renders rise and settle as they scroll into view.
- `ScrollLift`: the hero scene drifts with the scroll (parallax).
- `Reveal`: copy blocks fade up into view.
- `Stagger`: the route pins pop in one after another, then the steps rise in turn; the fact cards
  rise the same way.
- `TileRow`: the comparison tiles fill as they come into view, the usual invoice slowly, the TIBA
  row almost at once, landing on marigold.

Nothing is hidden in the server HTML: every hidden start state is set by the script, so without
JS the page is complete. With `prefers-reduced-motion` nothing moves: no smooth scroll, no
parallax, no reveals, and the hero's CSS animations are off.
