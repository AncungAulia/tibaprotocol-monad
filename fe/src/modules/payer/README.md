# Payer API integration

The screens use real wallet reads and writes. No successful payment or saved record is simulated. The backend and published contract package are not present in this checkout.

Required reads:

- `GET /api/relations` returns `Relation[]`, including `name`, `plate`, `status`, and `carrier_address`. Selectable statuses are `joined`, `connected`, or `active`.
- `GET /api/places` returns `Place[]`, including coordinates, kind, and linked `receiver_address`.
- `GET /api/places/search?q=...` returns `{ place_id, display_name, lat, lon }[]`. This provisional endpoint needs an autocomplete provider. Public Nominatim prohibits autocomplete; do not proxy its public endpoint for this feature. A failed search leaves manual address entry and map selection available.
- `GET /api/trips/:id` should include the saved trip plus populated `pickup`, `destination`, `carrier_name`, `carrier_phone`, latest `location`, and optional arrival `report`. Shared ledger polling refreshes it every 30 seconds.

Writes follow the tech spec:

- `POST /api/invites`: `{ kind: 'carrier' | 'warehouse', label, place_id?, email? }`. Return `{ url, expires_at? }` or `{ token, expires_at? }`. `email` is a provisional receiver contact field. The UI offers sharing; it does not claim an email was sent.
- `POST /api/places`: `{ name, address, lat, lng, kind }`. Return the saved `Place` with its `id`. Adding a destination then creates its warehouse invitation. If invitation creation fails, retry uses the already saved place.
- `POST /api/trips`: `{ shipment_id: string, pickup_place, destination_place, cargo }`. Compute road route and distance on the server using the configured route service. Require an idempotent save keyed by shipment_id because clients may retry after a lost response.

Creation saves the submitted transaction reference and immutable trip metadata in browser local storage scoped to the connected account. It decodes `ShipmentCreated` only from the configured manager and only after a successful receipt. A metadata save failure retries the same shipment, never another create transaction. Recovery survives closing and reopening the browser.

Payer overdue locking follows the spec: FINANCED only, after the 60-second demo grace period. Payment is offered for DELIVERED or FINANCED. Contract validation remains authoritative. Destination and pickup are shown as a direct preview until the backend supplies the road route.
