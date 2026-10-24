# @tiba/fe

Next.js App Router app for all four roles at `app.tibaprotocol.xyz`.

## Run

```bash
cp .env.example .env.local   # fill Privy + Supabase
pnpm install                # from the repo root
pnpm --filter @tiba/fe dev   # from the repo root
```

Keep `.env.local` out of Git. Leave `NEXT_PUBLIC_USDC_ADDRESS`,
`NEXT_PUBLIC_SHIPMENT_MANAGER_ADDRESS`, and `NEXT_PUBLIC_POOL_ADDRESS` empty
to use the redeployed Monad testnet contracts from `@tiba/sc`.
The root `pnpm-workspace.yaml` registers the Privy 3.51.0 patch in `patches/`.

## Structure

```
app/                     routes only; each page renders one screen from src/modules
  start/                 connect + who are you (Pencil A, B)
  onboarding/<role>/     C (payer), D (carrier), E (investor)
  join/[token]/          invite links (F)
  payer/ carrier/ pool/ warehouse/ confirm/[id]/
src/
  components/
    ui/                  shadcn primitives (popover, command, dialog, sheet...)
    elements/            Button, FanMeter, StatusChip, Amount, PersonaAvatar, PageHeading
    layout/              AppShell (navbar + mobile bottom nav), nav items per role
  modules/<role>/        components/ (screens + parts), hooks/, data/ (mock data first)
  lib/                   env, chain (wagmi), contracts (@tiba/sc), api (be/), format, supabase
  providers/             Privy + React Query + wagmi
  styles/globals.css     shared design tokens
```

The screens use the backend in [`be/`](../be/README.md) and the canonical
contract package in [`sc/`](../sc/README.md) in this workspace.

## UI rules

- English only in the UI. Plain words: no "on-chain", "hash", "yield", "liquidity". Technical detail goes behind "View receipt".
- Instrument Sans only, no monospace, no em dash, no uppercase with wide tracking. Currency is USDC only.
- Titles one color, description below the title.
- Buttons full width only on mobile or narrow containers; otherwise they hug the label.
- Validate while typing; long lists use the searchable combobox.
- No zap, sparkles, rocket or shield icons.

## Add shadcn components

```bash
pnpm --filter @tiba/fe dlx shadcn@latest add popover command dialog sheet
```
