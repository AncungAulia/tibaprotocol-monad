# @tiba/sc

TIBA contracts on Monad testnet (chain id 10143), built with Foundry.

| Contract | Kind | Role |
|---|---|---|
| `MockUSDC` | plain ERC-20, 6 decimals | Test USDC with a public faucet (1,000 USDC per wallet per hour) and an owner `mint` |
| `ShipmentManager` | UUPS proxy | Shipment records and the status cycle (APPROVED, IN_TRANSIT, DELIVERED or DISPUTED, FINANCED, REPAID) |
| `TibaPool` | UUPS proxy | Investor liquidity, credit limits, 97.5% advances, repayments (80% of the spread to the pool, 20% to the treasury) |

The package also exports typed ABIs and addresses for `fe` and `be` as TypeScript source (`index.ts`), so they need no build step. Relative imports use `.ts` extensions: bundlers need `allowImportingTsExtensions`, and an emitting `tsc` needs `rewriteRelativeImportExtensions`.

## Setup

```bash
git submodule update --init --recursive   # forge-std, OpenZeppelin contracts (+upgradeable), foundry-upgrades
cp .env.example .env                      # then fill PRIVATE_KEY and the demo wallets
```

OpenZeppelin Foundry Upgrades validates implementations through `npx @openzeppelin/upgrades-core` (ffi), so Node must be available. It also needs build info from a full compile, which is why the scripts run `forge clean` first.

## Build, test, format

```bash
pnpm --filter @tiba/sc build    # forge build + regenerate abi/*.ts
pnpm --filter @tiba/sc test     # forge clean && forge test
pnpm --filter @tiba/sc fmt
```

Commit the regenerated `abi/*.ts` whenever a contract's interface changes.

## Deploy, seed, upgrade

Load the env first (`set -a; source .env; set +a`), then:

```bash
pnpm --filter @tiba/sc deploy   # MockUSDC + both proxies, wired; writes deployments/10143.json
pnpm --filter @tiba/sc seed     # fills the pool with 20,000 USDC (only PRIVATE_KEY needed)
```

After deploying, run `pnpm --filter @tiba/sc export-abi` if you rebuilt, and commit `deployments/10143.json`. `fe` and `be` read the addresses from it.

Verify on all Monad explorers (MonadVision, Socialscan, Monadscan) in one go: MockUSDC, both implementations and both proxies, using the Monad verification API (see `docs/monad-notes.md`):

```bash
pnpm --filter @tiba/sc verify
```

Fallback for one contract: `forge verify-contract <addr> src/TibaPool.sol:TibaPool --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/`.

Keep every demo wallet above 10 MON: Monad holds a 10 MON reserve per account, and wallets below it can only send one transaction every 3 blocks.

Only `PRIVATE_KEY` is required. Everyone else connects their own wallet, picks a role in the app and takes test USDC from the faucet; a new payer gets the credit limit from be/ automatically. Seed deposits `SEED_LIQUIDITY` (20,000 USDC, standing in for other investors) so carriers can be paid early. The demo wallet variables are optional shortcuts for rehearsals. When `INVESTOR_PRIVATE_KEY` is set, Rina also deposits `INVESTOR_DEPOSIT` (5,000 USDC) from her own wallet, so the pool shows 25,000 with Rina at 20%, as in the design. Her wallet needs MON for gas beforehand.

To upgrade, put the new implementation in `src/` (for example `src/TibaPoolV2.sol`), with `/// @custom:oz-upgrades-from src/TibaPool.sol:TibaPool` on the contract, then:

```bash
TARGET=TibaPool NEW_IMPL=TibaPoolV2.sol CALL_DATA=$(cast calldata "initializeV2()") pnpm --filter @tiba/sc upgrade
```

The script reads the proxy address from `deployments/<chainId>.json`, validates storage compatibility, upgrades, and records the new implementation address.

## Upgrade rules

- No constructors with logic. Implementations call `_disableInitializers()` in the constructor. State is set in `initialize` (V1) or in a `reinitializer(n)` function (V2 and later).
- Storage is ERC-7201 namespaced (`tiba.storage.ShipmentManager`, `tiba.storage.TibaPool`). Storage is append-only: add new fields at the end of the namespaced struct (or of `Shipment` / `PayerStats`), or put them in a new namespace. Never reorder, rename the type of, or remove an existing field.
- Constants and immutables are part of the code, not storage. Changing them in a new implementation changes behavior for all existing positions.
- Only the owner can upgrade (`_authorizeUpgrade` is `onlyOwner`). Always run the validated `Upgrade.s.sol` rather than calling `upgradeToAndCall` directly.

Admin keys: on testnet, one admin key (the deployer) owns everything. On mainnet, ownership moves to a multisig behind a timelock.

## Design notes

- **Share math.** `totalAssets = idle + deployed`, where `deployed` is the sum of advances still out, at cost. Advancing moves value from idle to deployed, so the share price does not move. Repayment returns the advance plus 80% of the spread to idle without minting shares, so the share price rises. `available()` is idle cash. `maxWithdraw(addr)` is `min(value of shares, available())`, and `maxRedeem(addr)` is the share amount to pass to `withdraw`. Balances are tracked internally, so token donations cannot move the share price. A virtual share and asset of 1 handles the empty pool. First deposits mint 1:1.
- **Overdue tracking.** The pool keeps each payer's open FINANCED ids (swap-and-pop, O(1) add and remove). `hasOverdue(payer)` scans that list, which credit limits keep short. `createShipment` rejects payers with any overdue shipment. Repaying clears the block at once.
- **Credit.** `outstanding[payer]` is the full fee of financed, unpaid shipments. `createShipment` checks `outstanding + amount <= creditLimit` early, and `requestAdvance` re-checks it, so the limit holds even if many shipments were approved while outstanding was low.
- **Late.** A repayment is late when `block.timestamp > dueDate + GRACE`, using the same definition as `isOverdue`.
- Shipment ids start at 1, so 0 means "none".
