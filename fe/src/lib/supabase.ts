import { createClient } from "@supabase/supabase-js"
import { env } from "./env"

/** Browser client with the anon key: used for Realtime (truck locations, trip updates). */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey)
