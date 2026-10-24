# Onboarding API contract

The screens call the real API with a Privy bearer token and `X-Wallet-Address` matching the active, linked Ethereum wallet. They do not create local profiles, approve companies locally, or simulate accepted invitations.

- `GET /api/profile/me`: `{ address, profile: Profile | null, company }`. A successful `profile: null` opens role selection. HTTP errors, malformed profiles, and mismatched wallet addresses block routing. Existing profiles redirect to their role home after the wallet is on Monad testnet.
- `POST /api/profile`: payer `{role,name,phone_e164}`, carrier `{role,name,phone_e164,plate}`, or investor `{role,name}`. Expected response: saved `Profile`. Carrier response can include an absolute HTTP(S) `profile_url`; if absent, the screen explains the documented invitation flow and offers wallet address sharing. No public carrier route is invented.
- `POST /api/payer/submit`: fields from the `companies` table in `docs/specs/tiba-tech-spec.md`, with `trips_per_month` as an integer and `spend_per_month` as the user's decimal string. Country, province and city are sent as readable names; the pickers read public/places (Indonesia from the official Kemendagri list). Countries with no listed states/cities allow manual area entry. Response: saved `Company`, including actual `review_status`, `review_note`, and `credit_limit` in USDC units.
- `GET /api/payer/company`: same `Company` response or HTTP 404 when not yet submitted. In-review companies refresh every 15 seconds while this screen is mounted.
- `GET /api/invites/:token`: public `Invite`, optionally enriched with `verified`, `company_name`, `credit_limit`, `repaid_count`, `late_count`, `place_name`. Missing optional company claims are not invented. Invalid/missing expiry, passed expiry, or `used_by` prevent acceptance.
- `POST /api/invites/:token/accept`: authenticated empty body; any successful JSON object indicates acceptance. Warehouse profile and destination association must be created atomically by this endpoint for a new warehouse account. Carrier setup returns to the same invitation before acceptance.

The implementation follows issue #11's Privy token verification requirement. Older specification wording also mentions wallet signatures; no additional signature format is invented here. Backend and Privy configuration must confirm these contracts before live acceptance testing. Warehouse email code delivery and six-digit verification belong to the configured Privy login dialog; demo wallet sign in is also allowed by the PRD.

## Issue #20 verification

Set `NEXT_PUBLIC_PRIVY_APP_ID` in `fe/.env.local`. The same project's `PRIVY_APP_ID` and `PRIVY_APP_SECRET`, plus working Supabase credentials, belong in `be/.env`. Allow `http://localhost:3000` in the Privy app. Run `pnpm dev:fe` and `pnpm dev:be` in separate terminals.

Manual checks still required with that configuration:

- Cancel login or decline the wallet prompt, then retry; try WalletConnect without a browser extension.
- Connect a new wallet: choose payer, carrier, or investor; Continue opens that onboarding route.
- Connect an existing profile for each of the four roles: it opens the matching dashboard.
- Connect on another network: switching must finish before role selection or redirect.
- Change wallet accounts: the profile and API wallet header must follow the active linked account. An unlinked account must be verified before proceeding.
- Stop the backend or expire the session: show an error with retry/sign out instead of treating the wallet as new.

Unit tests cover profile envelopes, roles, wallet matching, missing/expired tokens, structured API errors, and cancellation messages. Live Privy login and browser network switching remain unverified without credentials. Other onboarding endpoints listed above still need agreement with the backend under their own issues.
