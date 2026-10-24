# @tiba/be

Backend API for TIBA. Express 5 + TypeScript on Node 22. It stores the off-chain data that supports
the contracts (profiles, companies, places, invites, trips, truck positions, problem reports) in
Supabase, verifies Privy sessions, and reads shipments from `ShipmentManager` on Monad testnet
(chain 10143) to check who may do what. Money and status decisions stay on chain.

## Setup

```bash
# from the repo root
pnpm install
cp be/.env.example be/.env      # then fill it in
```

Create the tables: run `be/supabase/setup.sql` once in the Supabase SQL editor. This includes
all six migrations and the atomic `save_profile` / `accept_invite` RPCs required by the API.
For an existing database, run only migrations not yet applied, in numeric order.
If 0001–0003 are already applied, run only `0004_location_source.sql` for the demo source label.
Then apply `0005_trip_pickup_broadcast.sql` for verified pickup time and the opaque GPS topic.
Apply `0006_quantity_pool_events.sql` for shipment quantities and receipt-verified investor history.
Do not rerun setup on an existing database. Updates should use new migrations.
Run `pnpm --filter @tiba/be verify:supabase` to check the active REST schema without reading row contents.
Run `be/supabase/verify.sql` in SQL Editor to inspect actual RLS, privileges, indexes and constraints.

For the time-based truck demo and GPS Broadcast, see the
[original location-simulation guide](https://github.com/AncungAulia/tibaprotocol/blob/8967c16/docs/location-simulation.md).
Only the backend was migrated here; the guide remains in the original repository.
After a carrier PATCHes `{ pickupTx }`, detail returns `simulation: { startedAt, durationSec }`
when demo mode is enabled. `DEMO_TRIP_SECONDS` defaults to 180. The `channel` field is restricted
to shipment participants, never investors. `pnpm --filter @tiba/be verify:broadcast` checks live transport.
`pnpm --filter @tiba/be simulate:location --help` describes the CLI. Simulation uses
`@turf/along`, the confirmed pickup time and the carrier-authenticated location endpoint.
The CLI remains a fallback. Demo mode is disabled by default and labeled in maps.

## Environment

| Variable                                    | Required         | Notes                                                     |
| ------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `PORT`                                      | no               | Default `4000`                                            |
| `CORS_ORIGIN`                               | no               | Comma-separated origins. Default `http://localhost:3000`  |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes              | Service role key stays on the server                      |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET`          | yes              | Privy dashboard                                           |
| `PRIVY_VERIFICATION_KEY`                    | no               | Skips the JWKS fetch when set                             |
| `MONAD_RPC_URL`                             | no               | Default `https://testnet-rpc.monad.xyz`                   |
| `ADMIN_PRIVATE_KEY`                         | for auto approve | TibaPool owner key, **testnet only**                      |
| `ORS_API_KEY`                               | no               | OpenRouteService. Without it, routes are straight lines   |
| `APP_URL`                                   | no               | Invite links: `${APP_URL}/join/{token}`                   |
| `DEMO_AUTO_APPROVE`                         | no               | `true` approves payers at once and calls `setCreditLimit` |
| `DEMO_CREDIT_LIMIT_USDC`                    | no               | Default `3000`                                            |
| `LOG_LEVEL`                                 | no               | Default `info`                                            |

Contract ABIs and addresses come from the workspace package `@tiba/sc`. It ships TypeScript
source, so `build.mjs` bundles it into `dist/index.js` with esbuild (npm dependencies stay
external). Redeploying the contracts means rebuilding the backend.
The canonical deployment is `sc/deployments/10143.json`; do not copy old contract addresses
into backend environment variables.

When switching to a redeployed `ShipmentManager`, use a fresh Supabase project/dataset or
plan an explicit data migration first. Existing trips are keyed by shipment ID, not by
contract address, so IDs from old and new deployments can collide. Copying `be/.env`
preserves its database connection; it does not migrate or clear existing shipment data.
Do not reset a shared database as part of a code-only repository migration.

The backend API-contract suite uses explicit client wire payloads and response assertions.
It runs independently of the frontend; frontend adapter behavior should be tested by the
frontend suite when that package is migrated.

## Run

```bash
pnpm --filter @tiba/be dev        # tsx watch, reads be/.env
pnpm --filter @tiba/be test       # vitest
pnpm --filter @tiba/be typecheck
pnpm --filter @tiba/be build      # tsc type check, then esbuild bundle -> be/dist/index.js
pnpm --filter @tiba/be start      # node dist/index.js
```

## Auth

Every protected route expects `Authorization: Bearer <Privy access token>` (from `getAccessToken()`
in the Privy React SDK). The server resolves the user's linked Ethereum wallets through the Privy
API. When a user has more than one, send `X-Wallet-Address: 0x...` to choose the one the request
acts as; otherwise the first external wallet (then the embedded one) is used. Wallet ownership is
proven by Privy when the wallet is linked, so no separate signature is needed.

Errors always look like `{ "error": { "code": "...", "message": "plain sentence", "details"? } }`.
`message` is safe to show to users.

## Routes

| Method | Path                         | Auth                      | What it does                                                                                                               |
| ------ | ---------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                    | none                      | Liveness check                                                                                                             |
| GET    | `/api/profile/me`            | yes                       | `{ address, profile, company }`; `profile: null` means show the role picker                                                |
| POST   | `/api/profile`               | yes                       | Set role + basic data (`payer`, `carrier`, `investor`). One wallet, one role                                               |
| GET    | `/api/profile/:address`      | none                      | Public profile card for share links (no phone or email)                                                                    |
| POST   | `/api/payer/submit`          | payer                     | Save company details. With auto approve: approve + `setCreditLimit`, returns `txHash`                                      |
| GET    | `/api/invites`               | payer                     | Your invites with state and URL                                                                                            |
| POST   | `/api/invites`               | payer                     | `{ kind: carrier\|warehouse, label?, placeId? }` returns `{ invite, url }`, 7-day expiry                                   |
| GET    | `/api/invites/:token`        | none                      | Preview: inviter company, kind, place, `state: valid\|expired\|used`                                                       |
| POST   | `/api/invites/:token/accept` | yes                       | Carrier: adds to the payer's network. Warehouse: binds wallet to the destination (creates the warehouse profile if needed) |
| GET    | `/api/network`               | payer, carrier            | Payer: carriers + destinations. Carrier: companies                                                                         |
| GET    | `/api/places`                | payer, warehouse          | Payer: own places. Warehouse: destinations bound to them. `?kind=` filter                                                  |
| POST   | `/api/places`                | payer                     | Save a pickup point or destination (name, address, lat/lng from the pin)                                                   |
| GET    | `/api/trips`                 | yes                       | Trips linked to you (payer, carrier or receiver)                                                                           |
| POST   | `/api/trips`                 | shipment payer            | After `ShipmentCreated`: store cargo, places and the road route (ORS, straight line fallback)                              |
| GET    | `/api/trips/:id`             | related party or investor | Shipment/trip detail, simulation clock, and participant-only Broadcast channel                                             |
| PATCH  | `/api/trips/:id`             | shipment carrier          | `{ pickupTx?, shareLocation? }`, at least one field; verifies pickup receipt and stores its block timestamp                |
| POST   | `/api/locations`             | shipment carrier          | `{ shipmentId, lat, lng, recordedAt? }`, only while IN_TRANSIT and sharing is on                                           |
| POST   | `/api/reports`               | shipment consignee        | `{ shipmentId, issues[], receivedQty, note? }`, sent with `confirmDelivery(id, false, qty)`                                |
| GET    | `/api/reports/:id`           | related party             | Read the report                                                                                                            |
| GET    | `/api/code/:code`            | yes                       | Find a shipment from its 6-character code; `forYou` tells the warehouse if it is theirs                                    |

The browser reads truck positions through the authenticated trip endpoint. Direct anonymous
reads of trips and locations are disabled by migration 0003. Realtime publication membership
alone does not grant clients read access.

## Shipment code

`src/lib/shipment-code.ts` turns a shipment id into a 6-character code (Crockford base32: 5
characters for a scrambled 25-bit id plus 1 checksum character). It accepts lowercase, spaces,
dashes and `O`/`I`/`L` look-alikes, and rejects any single mistyped character.

## Deploy (Railway or Render)

Both platforms can build from the monorepo root:

- **Root directory:** repo root (pnpm workspace needs `@tiba/sc`)
- **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @tiba/be build`
- **Start command:** `pnpm --filter @tiba/be start`
- **Health check path:** `/health`
- **Node:** 22 (set `NODE_VERSION=22` on Render if needed)
- Set every variable from `.env.example`. The platform provides `PORT`.
- Add the deployed frontend origin to `CORS_ORIGIN`.

Keep `ADMIN_PRIVATE_KEY` a testnet-only key with just enough MON for gas.
