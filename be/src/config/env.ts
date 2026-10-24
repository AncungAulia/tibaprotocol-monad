import { z } from "zod"

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1")

const hexPrivateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex string")

/**
 * The Privy dashboard shows the verification key as bare base64; Privy's SDK needs PEM.
 * Accepts either, plus PEM pasted on one line with literal "\n".
 */
function toPem(key: string): string {
  const value = key.trim().replace(/\\n/g, "\n")
  if (value.includes("BEGIN PUBLIC KEY")) return value
  const body = value.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? ""
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Comma-separated list of allowed origins. */
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  /** Optional: the app's JWT verification key (SPKI). Skips the JWKS fetch when set. */
  PRIVY_VERIFICATION_KEY: z
    .string()
    .optional()
    .transform((key) => (key ? toPem(key) : undefined)),

  MONAD_RPC_URL: z.url().default("https://testnet-rpc.monad.xyz"),
  /** Testnet-only owner key of TibaPool, used for setCreditLimit. */
  ADMIN_PRIVATE_KEY: hexPrivateKey.optional(),

  /** MON sent once to each new email wallet so it can pay network fees. 0 turns it off. */
  GAS_TOPUP_MON: z.coerce.number().min(0).default(0.1),
  /** Wallets holding at least this much MON get no top-up. */
  GAS_TOPUP_BELOW_MON: z.coerce.number().min(0).default(0.02),
  /** Stop topping up when the admin wallet would drop below this. */
  GAS_TOPUP_ADMIN_FLOOR_MON: z.coerce.number().min(0).default(1),

  ORS_API_KEY: z.string().optional(),
  APP_URL: z.url().default("https://app.tibaprotocol.xyz"),

  DEMO_AUTO_APPROVE: booleanString,
  DEMO_CREDIT_LIMIT_USDC: z.coerce.number().positive().default(3000),
  /** Explicit opt-in for simulated location samples. Real GPS is unaffected. */
  DEMO_LOCATION_SIMULATION: booleanString,
  /** Total demo travel time from the verified pickup block timestamp. */
  DEMO_TRIP_SECONDS: z.coerce.number().int().positive().default(180),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  // Treat `KEY=` (empty) the same as unset, so .env files copied from .env.example work.
  const raw = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== ""),
  )
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => {
        const key = issue.path.join(".")
        return raw[key] === undefined ? `  ${key}: is required` : `  ${key}: ${issue.message}`
      })
      .join("\n")
    throw new Error(`Invalid environment variables:\n${issues}`)
  }
  return parsed.data
}

export const env = loadEnv()

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean)
