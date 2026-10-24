// Read-only checks. Never print credentials or row contents.
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const envPath = fileURLToPath(new URL("../.env", import.meta.url))
if (existsSync(envPath)) process.loadEnvFile(envPath)
const url = process.env.SUPABASE_URL?.replace(/\/$/, "")
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
for (const file of ["../../fe/.env.local", "../../fe/.env"]) {
  const frontendEnv = fileURLToPath(new URL(file, import.meta.url))
  if (existsSync(frontendEnv)) process.loadEnvFile(frontendEnv)
}
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const tables = {
  profiles: "address,role,name,phone_e164,email,plate,created_at",
  companies:
    "payer_address,company_name,registration_no,country,province,city,street,postal_code,contact_name,contact_role,phone_e164,trips_per_month,spend_per_month,review_status,review_note,credit_limit,credit_limit_tx,created_at,updated_at",
  places: "id,payer_address,name,address,lat,lng,kind,receiver_address,receiver_email,created_at",
  invites:
    "token,kind,payer_address,label,place_id,receiver_email,expires_at,used_by,used_at,created_at",
  relations: "payer_address,carrier_address,status,created_at",
  trips:
    "shipment_id,payer_address,carrier_address,consignee_address,pickup_place,destination_place,cargo,quantity,route_geojson,route_source,distance_km,duration_min,share_location,picked_up_at,channel_key,created_at",
  locations: "id,shipment_id,lat,lng,recorded_at,source",
  reports: "shipment_id,issues,received_qty,note,reporter_address,created_at",
  gas_topups: "address,amount_wei,tx_hash,created_at",
  pool_events: "tx_hash,log_index,investor,kind,assets,block,created_at",
}
let failures = 0
async function check(path, key, headers = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", ...headers },
    signal: AbortSignal.timeout(15000),
  })
}
for (const [table, columns] of Object.entries(tables)) {
  const response = await check(`${table}?select=${columns}&limit=0`, service)
  console.log(
    JSON.stringify({
      check: "schema",
      table,
      ok: response.ok,
      status: response.status,
      rows: response.headers.get("content-range")?.split("/")[1] ?? null,
    }),
  )
  if (!response.ok) failures++
  if (anon) {
    const publicResponse = await check(`${table}?select=*&limit=0`, anon)
    const count = publicResponse.headers.get("content-range")?.split("/")[1]
    const exposed = publicResponse.ok && count !== "0" && count != null
    console.log(
      JSON.stringify({
        check: "anonymous-read",
        table,
        status: publicResponse.status,
        visibleRows: count ?? null,
        exposed,
      }),
    )
    if (exposed) failures++
  }
}
if (!anon)
  console.log(
    JSON.stringify({ check: "anonymous-read", skipped: "No frontend anon key configured" }),
  )
const schemaResponse = await fetch(`${url}/rest/v1/`, {
  headers: {
    apikey: service,
    Authorization: `Bearer ${service}`,
    Accept: "application/openapi+json",
  },
  signal: AbortSignal.timeout(15000),
})
if (schemaResponse.ok) {
  const schema = await schemaResponse.json()
  for (const name of ["save_profile", "accept_invite"]) {
    const exists = !!schema.paths?.[`/rpc/${name}`]
    console.log(JSON.stringify({ check: "rpc-schema", function: name, exists }))
    if (!exists) failures++
  }
} else {
  console.log(
    JSON.stringify({
      check: "rpc-schema",
      skipped: "OpenAPI metadata is unavailable; inspect verify.sql",
    }),
  )
}
console.log(
  JSON.stringify({
    check: "limits",
    note: "REST checks verify tables/columns and current anonymous visibility, not empty-table policies, constraints, indexes, or publication configuration. Use verify.sql for database metadata.",
  }),
)
process.exitCode = failures ? 1 : 0
