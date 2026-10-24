# TIBA — Tokenized Invoice Based on Arrival

TIBA helps freight carriers collect an agreed shipping fee after delivery instead of waiting until the payer's due date. A shipping company approves the fee and receiver in advance; the receiver confirms arrival; the carrier can then request **97.5% of the fee** from an investor-funded pool. The payer later repays the full fee. The remaining 2.5% is split 80% to the pool and 20% to the treasury.

The prototype serves shipping companies (payers), carriers, warehouse receivers, and liquidity providers. Delivery acceptance gates financing through a shared contract state machine. Pool shares are internal accounting balances, not transferable invoice NFTs.

## Live demo and contracts

| Resource             | Link / status                                                                           |
| -------------------- | --------------------------------------------------------------------------------------- |
| Live application     | [app.tibaprotocol.xyz](https://app.tibaprotocol.xyz/start)                              |
| Product landing page | [tibaprotocol-monad.vercel.app](https://tibaprotocol-monad.vercel.app)                  |
| Public repository    | [AncungAulia/tibaprotocol-monad](https://github.com/AncungAulia/tibaprotocol-monad)     |
| Demo video           | `<DEMO_VIDEO_URL>` — public video URL not found                                         |
| Network              | **Monad Testnet**, chain ID **10143**, gas token **MON**                                |
| RPC / MON faucet     | [Testnet RPC](https://testnet-rpc.monad.xyz) / [Monad faucet](https://faucet.monad.xyz) |

Canonical addresses come from [sc/deployments/10143.json](sc/deployments/10143.json). Use the **proxy** addresses for application calls.

| Contract                       | Function                                                  | Network       | Address                                      | Explorer                                                                                      |
| ------------------------------ | --------------------------------------------------------- | ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| MockUSDC                       | Six-decimal test token and faucet                         | Monad Testnet | `0xD2f7B1763b80dce299843A4b81d792C80F8AB530` | [Code](https://testnet.monadscan.com/address/0xD2f7B1763b80dce299843A4b81d792C80F8AB530#code) |
| ShipmentManager proxy          | Shipment participants, fee, due date, delivery status     | Monad Testnet | `0x050693339be3164A4B07C1cca4280a910B5b17FE` | [Code](https://testnet.monadscan.com/address/0x050693339be3164A4B07C1cca4280a910B5b17FE#code) |
| TibaPool proxy                 | Deposits, withdrawals, credit limits, advances, repayment | Monad Testnet | `0xF1a0d9DE2Da6a8811bF1f33ac6ceed67acF1e85c` | [Code](https://testnet.monadscan.com/address/0xF1a0d9DE2Da6a8811bF1f33ac6ceed67acF1e85c#code) |
| ShipmentManager implementation | Logic behind the manager proxy                            | Monad Testnet | `0x68C4F80c98Bb397052F98780aAb8fb1efA9A8d7e` | [Code](https://testnet.monadscan.com/address/0x68C4F80c98Bb397052F98780aAb8fb1efA9A8d7e#code) |
| TibaPool implementation        | Current pool logic after upgrade                          | Monad Testnet | `0xD4859b488BE6C3FE7AD3AE4a432aA312176d047e` | [Code](https://testnet.monadscan.com/address/0xD4859b488BE6C3FE7AD3AE4a432aA312176d047e#code) |

Checked on 24 October 2026: Monadscan shows **Source Code Verified / Exact Match** for MockUSDC, ShipmentManager's proxy and implementation, and the current TibaPool implementation. The TibaPool proxy page also references a **Similar Match** to the ShipmentManager proxy; its independent verification status is not asserted here. Read-only RPC checks confirmed bytecode at all three application addresses and both proxy implementation slots matching the manifest. Verification is not a security audit.

## Working features

- Wallet or email login through Privy, role onboarding, company submission, carrier invitations, and destination receiver invitations.
- Payers save pickup/destination places and create shipments with a fixed fee, due date, carrier, and receiver. Trip metadata is saved separately after the creation receipt; interrupted saves can resume.
- Carriers confirm pickup and optionally share browser GPS. Receivers scan a QR code or enter a six-character shipment code, then accept delivery or report a problem with received quantities.
- Accepted deliveries enable a carrier-requested 97.5% advance, subject to payer credit and available pool cash. Disputed deliveries cannot be financed.
- Investors deposit MockUSDC, receive pool shares, inspect their transaction history, and withdraw up to the available idle cash. Payers repay financed bills; an unfinanced accepted delivery can instead be paid in full directly to the carrier through the pool contract.
- Dashboards read contract state and expose transaction receipts. Financed overdue bills block new shipments; the demo grace period is 60 seconds after the due date.

## How to try the demo

Use separate wallets/accounts for payer, carrier, receiver, and optionally investor. Each wallet has one application role; use separate browser profiles to keep sessions apart. Warehouse accounts join through a payer's destination invitation.

1. Open the live app and sign in with a wallet or email. Email login creates an embedded wallet. Select **Monad Testnet (10143)** when prompted. Every transacting account needs test MON; use the faucet above if the configured automatic gas top-up is unavailable.
2. For the shortest independent check, choose **Investor**, complete onboarding, and use the wallet menu's **Get 1,000 test USDC**. This calls this project's MockUSDC faucet, limited to one claim per wallet per hour. Deposit **100 USDC**, approve the token allowance and deposit transaction, then inspect your position and receipt. Withdraw **10 USDC** if enough idle cash remains. This is test USDC, not Circle USDC or real money.
3. For the delivery flow, onboard a **Payer** and submit demo company/contact details. Continue once the company is approved and its on-chain credit limit is nonzero. New payer approval depends on the backend owner wallet and demo approval configuration; an account stuck in review cannot create shipments.
4. In the payer's network screen, invite a **Carrier**, save a pickup point and a destination, and share the destination's **Warehouse** invitation. Accept each link in the corresponding account. The destination must show a linked receiver before it can be selected.
5. Create a shipment: for example cargo **20 boxes**, quantity **20**, shipping fee **100 USDC**, and a due date tomorrow. Choose the connected carrier and linked destination, then approve creation in the payer wallet. Expect `APPROVED` and a saved trip with a shipment code.
6. As the carrier, open the trip and **Confirm pickup**. Expect `IN_TRANSIT`. GPS sharing needs location permission; arrival is still confirmed by the receiver, not by the map.
7. As the invited receiver, scan the trip QR code or enter its shipment code, confirm **20** received items, and accept arrival. Expect `DELIVERED`. Use the acceptance path for this financing walkthrough; a problem report leads to `DISPUTED`.
8. Ensure the pool has at least **97.50 USDC** idle cash (the investor can deposit it). As the carrier, select **Get paid now**. Expect **97.50 USDC** in the carrier wallet and status `FINANCED`.
9. As the payer, claim test USDC, open the bill, and pay **100 USDC**, approving the allowance if requested. Expect `REPAID`: **97.50** principal returns to the pool, **2.00** goes to pool earnings, and **0.50** to the treasury. Repayment can be demonstrated before the due date. Open **View receipt** to verify the transaction on Monadscan.

Dashboard polling can take 15–30 seconds to reflect another participant's action. If an advance fails, check idle pool cash and payer credit. If an external wallet cancels a transaction, retry from the same shipment.

## Why Monad

Monad is the settlement layer for shipment creation, pickup, receiver acceptance/dispute, pool deposits and withdrawals, credit limits, advances, and repayments. The implementation uses Solidity, OpenZeppelin UUPS proxies, Foundry, and viem/wagmi against Monad's EVM JSON-RPC, allowing the same tools and ABI package to serve both client and server.

The important property for this product is shared, enforceable settlement: only the recorded carrier can pick up or request an advance, only the receiver can accept delivery, and the pool checks delivery state, credit, and liquidity before transferring tokens. Repayment updates accounting and transfers funds in one contract transaction. No application-specific throughput, latency, or gas-cost benchmark has been measured here.

Company identity, invitations, addresses, cargo descriptions, planned quantities, route geometry, GPS, and problem notes remain off-chain. A receiver's submitted quantity and acceptance decision are recorded on-chain. GPS and demo animation do not independently prove physical delivery.

## Architecture and tech stack

```text
Browser: Next.js 15 / React 19 / Tailwind 4
  |-- Privy login + wagmi/viem --> Monad Testnet contracts (signed user transactions)
  |-- Privy bearer token ------> Express 5 / TypeScript API
                                  |-- Supabase Postgres: profiles, trips, invites, reports, pool history
                                  |-- Supabase Broadcast: participant location updates
                                  |-- Monad RPC: state/receipt validation; owner credit-limit transactions
                                  |-- Photon: address search; OpenRouteService: road routes
```

The API validates wallet identity and shipment participation before protected operations. It verifies pickup and investor-history receipts rather than trusting submitted transaction hashes. Supabase's service role key stays server-side; frontend Supabase access uses an anon key. Maps use MapLibre with CARTO basemaps. Without OpenRouteService, routes fall back to straight lines.

| Directory                               | Purpose / further documentation                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [fe/](fe/README.md)                     | Role dashboards, Privy sessions, wallet reads/writes, maps                                           |
| [be/](be/README.md)                     | Authenticated API, database setup, deployment and service checks                                     |
| [sc/](sc/README.md)                     | Solidity contracts, Foundry tests/scripts, typed ABIs and canonical addresses exported as `@tiba/sc` |
| [landing-page/](landing-page/README.md) | Separate Next.js 16 static marketing site; GSAP/Lenis motion                                         |

## Local setup

### Prerequisites and installation

- Node.js **22 or newer** (local checks below used Node 24.18.0), **pnpm 10.18.0**, and Git.
- Foundry (`forge` and `cast`) for contract build/test/deployment; Solidity **0.8.28** is pinned in [foundry.toml](sc/foundry.toml). The web/API can use committed ABIs without compiling Solidity.
- A Supabase project and a Privy app with wallet/email login and `http://localhost:3000` allowed. Use the same Supabase project and Privy app for frontend and backend.
- For automatic payer approval against the existing deployment, access to its TibaPool owner wallet is required. A fresh developer cannot grant credit using an unrelated wallet; use an already approved demo account or an independently deployed test instance.

From a terminal:

```sh
git clone https://github.com/AncungAulia/tibaprotocol-monad.git
cd tibaprotocol-monad
pnpm install --frozen-lockfile
git submodule update --init --recursive
```

The submodule step fetches forge-std and OpenZeppelin dependencies. Preserve the committed pnpm lockfile and [Privy patch](patches/@privy-io__react-auth@3.51.0.patch).

### Environment and database

From the repository root, copy the tracked examples (PowerShell):

```powershell
Copy-Item fe/.env.example fe/.env.local
Copy-Item be/.env.example be/.env
```

On Bash, use `cp` with the same source/destination paths. Fill the copies locally; these are safe example values, not working credentials:

| File                        | Variables / example values                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fe/.env.local`             | `NEXT_PUBLIC_API_URL=http://localhost:4000`; `NEXT_PUBLIC_PRIVY_APP_ID=<PRIVY_APP_ID>`; `NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co`; `NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>`                               |
| `be/.env`                   | `SUPABASE_URL=https://<PROJECT_REF>.supabase.co`; `SUPABASE_SERVICE_ROLE_KEY=<SERVER_SERVICE_ROLE_KEY>`; `PRIVY_APP_ID=<PRIVY_APP_ID>`; `PRIVY_APP_SECRET=<SERVER_PRIVY_SECRET>`                                                        |
| Local origins / invitations | In `be/.env`: `PORT=4000`, `CORS_ORIGIN=http://localhost:3000`, **`APP_URL=http://localhost:3000`** so invitations return to your local app                                                                                             |
| Chain                       | Keep `MONAD_RPC_URL` (backend) and `NEXT_PUBLIC_MONAD_RPC_URL` (frontend) at `https://testnet-rpc.monad.xyz`; explorer and faucet defaults are in `fe/.env.example`                                                                     |
| Contract addresses          | Leave all three frontend address overrides blank to use `@tiba/sc`. Backend addresses always come from the deployment manifest                                                                                                          |
| Demo approval               | The backend example sets `DEMO_AUTO_APPROVE=true`, `DEMO_CREDIT_LIMIT_USDC=3000`; this needs `ADMIN_PRIVATE_KEY=<TESTNET_POOL_OWNER_PRIVATE_KEY>` and MON. Set `DEMO_AUTO_APPROVE=false` if unavailable; new companies remain in review |
| Gas top-ups                 | `GAS_TOPUP_MON=0.1`, `GAS_TOPUP_BELOW_MON=0.02`, `GAS_TOPUP_ADMIN_FLOOR_MON=1` configure owner-funded top-ups. Set `GAS_TOPUP_MON=0` to disable                                                                                         |
| Optional services           | `ORS_API_KEY=<OPENROUTESERVICE_KEY>` enables road routes; blank uses straight lines. `PRIVY_VERIFICATION_KEY` optionally avoids a JWKS fetch. `LOG_LEVEL=info` is the default                                                           |
| Optional simulation         | `DEMO_LOCATION_SIMULATION=false`, `DEMO_TRIP_SECONDS=180`. Enable explicitly for a labeled time-based demo; `DEMO_CARRIER_TOKEN` is only for the optional simulation CLI                                                                |

Never put a private key, Privy secret, or Supabase service role key in `NEXT_PUBLIC_*` variables. Leave optional secrets blank when unused; never commit populated env files.

For a **new** Supabase project, run [be/supabase/setup.sql](be/supabase/setup.sql) once in its SQL editor. It includes six migrations and the profile/invite RPCs. For an existing project, apply only missing files from [be/supabase/migrations/](be/supabase/migrations/) in numeric order. Do not rerun full setup on a shared database. [verify.sql](be/supabase/verify.sql) checks database permissions and constraints.

### Run

Run these in separate terminals, both from the repository root:

```sh
pnpm dev:be
```

```sh
pnpm dev:fe
```

Open [localhost:3000](http://localhost:3000); the API health endpoint is [localhost:4000/health](http://localhost:4000/health). The dev script loads `be/.env`; Next.js loads `fe/.env.local`.

No new contract deployment is needed to use the committed Monad Testnet addresses. This frontend/backend are configured for chain 10143; a fully local Anvil integration is not supplied.

Optional landing page: copy `landing-page/.env.example` to `.env.local` in that directory, set `NEXT_PUBLIC_APP_URL=http://localhost:3000` and `NEXT_PUBLIC_SITE_URL=http://localhost:3001`, then run `pnpm --filter @tiba/landing dev --port 3001` from root. Its build exports static files to `landing-page/out/`.

### Build and test

All commands below run from the repository root:

```sh
pnpm --filter @tiba/fe test
pnpm --filter @tiba/be test
pnpm --filter @tiba/landing test
pnpm --filter @tiba/fe typecheck
pnpm --filter @tiba/be typecheck
pnpm --filter @tiba/landing typecheck
pnpm build:sc
pnpm test:sc
pnpm build
pnpm build:landing
```

`pnpm build` compiles contracts, regenerates typed ABIs, then builds the API and app. Landing builds separately. For only the web/API, run `pnpm --filter @tiba/be build` and `pnpm --filter @tiba/fe build`. For production API startup, provide environment variables through the host/process before `pnpm --filter @tiba/be start`; that command does not load `.env` itself. Run `pnpm --filter @tiba/fe start` after its build. Package lint scripts are in each `package.json`; the root `pnpm lint` runs available workspace lint scripts.

Backend unit tests use dummy service settings and mocked external services; they do not require live credentials. `pnpm --filter @tiba/be verify:chain` is a read-only live configuration check. **Do not use `be e2e`, contract `smoke`, `seed`, or `deploy` as read-only checks**: they exercise live services and/or send transactions.

## Contract deployment and verification

The committed [deployment broadcast](sc/broadcast/Deploy.s.sol/10143/run-latest.json) contains successful creation receipts. Read-only RPC receipt/block queries confirmed these timestamps:

| Contract              | Deployment transaction                                                                                                                                                    | Block    | Time (UTC, 24 October 2026) |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| MockUSDC              | [0x99b9d81daae989be1a7c0da06a86cb9280dab635c46126d06e74d6f389bf91bb](https://testnet.monadscan.com/tx/0x99b9d81daae989be1a7c0da06a86cb9280dab635c46126d06e74d6f389bf91bb) | 73722976 | 04:46:43                    |
| ShipmentManager proxy | [0x51bf92de719ef233e955896f9483b94e1e2702a7bd4243d4ad8b13881acd6b96](https://testnet.monadscan.com/tx/0x51bf92de719ef233e955896f9483b94e1e2702a7bd4243d4ad8b13881acd6b96) | 73722984 | 04:46:46                    |
| TibaPool proxy        | [0x04d383f9b1da1dcf50779044ef896c43e8e3fe6fc35e4eb4838732fed751b737](https://testnet.monadscan.com/tx/0x04d383f9b1da1dcf50779044ef896c43e8e3fe6fc35e4eb4838732fed751b737) | 73722996 | 04:46:49                    |

These times are **11:46:43–11:46:49 WIB (UTC+7)** on the date of [Monad Blitz Jogja Vol. 2](https://luma.com/blitz-jogja-okt-2026). The published schedule lists coding from 10:15 to 16:30 WIB. This supports deployment within that published window; it does not establish complete submission eligibility or organizer acceptance.

The manifest's `deployedAtBlock=73722904` is the script's recorded block, not a creation receipt block; use the receipt blocks above for deployment evidence. The original TibaPool implementation was `0xBED117Fc48aF38618302061Dd99E1ddf5f4351A2`. The [upgrade broadcast](sc/broadcast/Upgrade.s.sol/10143/run-latest.json) records the current implementation creation at [0x4e17c372484a73ed913838b5d020f5da77c081e375da38a808e01a32e3cf998b](https://testnet.monadscan.com/tx/0x4e17c372484a73ed913838b5d020f5da77c081e375da38a808e01a32e3cf998b) and proxy upgrade at [0x61908777c43242680652b2a61878d97a9eef03b166f08493f3fd1edc76db1ef2](https://testnet.monadscan.com/tx/0x61908777c43242680652b2a61878d97a9eef03b166f08493f3fd1edc76db1ef2). Its broadcast file timestamp is 24 October 2026, 05:45:59 UTC; that is not presented as a block timestamp.

For a maintainer deploying a separate instance, initialize submodules and dependencies first, then use **Bash/WSL**, starting at the repository root:

```bash
cd sc
cp .env.example .env
# Edit .env locally: PRIVATE_KEY is a funded testnet deployer; leave USDC blank for MockUSDC.
# Leave unused optional address/number settings unset rather than exporting empty values.
set -a
source .env
set +a
pnpm deploy
pnpm seed       # Optional: owner-funded demo liquidity, default 20,000 MockUSDC
pnpm verify
```

These are documented transaction-producing commands, **not run for this README change**. Deployment wires both UUPS proxies and writes `sc/deployments/10143.json`; rebuild API/frontend after changing it and regenerate ABIs with `pnpm --filter @tiba/sc export-abi` from root. A new manager restarts shipment IDs: use a fresh database or an explicit migration to avoid collisions with existing trip data.

`pnpm verify` submits compiler input to the Monad verification API via [sc/scripts/verify.mjs](sc/scripts/verify.mjs). It requires `forge`, `cast`, compiled artifacts, and the matching `broadcast/Deploy.s.sol/10143/run-latest.json` for proxy constructor arguments. Confirm results on the explorer; running the script alone does not prove verification. No new verification submission was made during this documentation update.

## Limitations / Future Work

- Testnet prototype using an owner-mintable mock token. Seeded liquidity represents demo funding; dashboard balances are not evidence of commercial freight activity.
- Credit approval is an owner-controlled demo workflow, not automated underwriting or identity verification. The owner can upgrade both contracts. Multisig/timelock governance is future work, not a current deployment claim.
- Receiver confirmation is trusted input. GPS needs permission and service availability; optional time-based location simulation is labeled and disabled by default. `/dev` and UI preview tooling use sample data and do not demonstrate live settlement.
- No dispute-resolution transition, collateral liquidation, or bad-debt recovery is implemented. A disputed shipment cannot proceed to financing. Pool asset accounting carries advances at cost; withdrawals can be limited by idle cash, and repayment is not guaranteed.
- Privy, Supabase, Monad RPC, Photon, and CARTO are external dependencies. OpenRouteService is optional. Address search can fail; manual entry/map pin placement remains available. Invitations are shared links; entering a receiver email does not send an invitation email.
- No production audit, mainnet deployment, or measured throughput/cost claims are provided. Full authenticated multi-account live acceptance testing remains separate from unit tests and HTTP availability checks.

## Team and credits

Git history attributes the following work; these are commit author names, not independently verified legal identities or a confirmed hackathon roster:

| Contributor | Work visible in this repository                        |
| ----------- | ------------------------------------------------------ |
| `ancung`    | Smart contracts, deployment tooling, and landing page  |
| `Yeypayeyy` | Frontend role screens, wallet integration, shared UI   |
| `Nasta`     | Backend API, auth, data services, verification scripts |

Confirm the submission roster and contact details: `<TEAM_ROSTER_AND_CONTACT>`.

Core dependencies include Next.js, React, Tailwind CSS, Privy, wagmi, viem, Supabase, Express, Zod, Foundry, forge-std, OpenZeppelin Contracts/Upgrades, MapLibre, Turf, Photon, OpenRouteService, CARTO, GSAP, and Lenis. Contracts carry SPDX MIT notices. Place-data credits and licenses are in [fe/public/places/README.md](fe/public/places/README.md); flag-icons attribution is in [its MIT license](fe/public/flags/LICENSE-flag-icons.txt). The landing README credits the `forepay/landing-page` architecture/motion reference. Several commits migrate earlier TIBA work; event-specific originality eligibility has not been established here.

## Validation and submission gaps

Documentation checks on 24 October 2026: package scripts, paths, example environment names, contract constants, tracked broadcast receipts, live app/landing HTTP 200 responses, public GitHub visibility, explorer source labels, and read-only RPC deployment evidence were inspected. Local frontend tests passed **79/79**, backend **108/108**, and landing **114/114**. `pnpm --filter @tiba/sc exec forge build` succeeded with Solidity 0.8.28 and timestamp-related lint warnings. Contract tests, production builds, typecheck scripts, fresh dependency installation, and the authenticated live flow were not run for this documentation change; their commands were checked against the repository. These results do not constitute a live end-to-end test.

Before submission, fill `<DEMO_VIDEO_URL>` and `<TEAM_ROSTER_AND_CONTACT>`, confirm the TibaPool proxy's independent verification status, and rehearse the authenticated multi-role flow. The [organizer's submission guide](https://github.com/monad-developers/monad-blitz-jogja) directs teams to fork its template and continue through the [Blitz Portal](https://blitz.devnads.com). Template-fork compliance, portal submission, team registration, and complete eligibility have not been verified by this README update.
