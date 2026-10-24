import { createClient, type PostgrestError } from "@supabase/supabase-js"
import { env } from "../config/env.js"
import { logger } from "./logger.js"
import { HttpError } from "./http-error.js"

/** Service-role client. Bypasses RLS, so every route must enforce access itself. */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type QueryResult<T> = { data: T; error: null } | { data: unknown; error: PostgrestError }

/** Unwraps a Supabase result, turning database errors into a generic 502. */
export function unwrap<T>(result: QueryResult<T>, context: string): T {
  if (result.error) {
    logger.error({ err: result.error, context }, "supabase query failed")
    throw HttpError.upstream("We could not reach our database. Please try again in a minute.")
  }
  return result.data as T
}
