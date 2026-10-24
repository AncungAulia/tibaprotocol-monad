export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://testnet.monadscan.com",
  monFaucetUrl: process.env.NEXT_PUBLIC_MON_FAUCET_URL ?? "https://faucet.monad.xyz",
}
