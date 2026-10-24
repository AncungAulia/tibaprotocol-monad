// Public URLs. "Open the app" points at the deployed TIBA app, set per deploy in
// NEXT_PUBLIC_APP_URL. Until it exists the buttons stay on this page ("#").
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "#"

export const GITHUB_URL = "https://github.com/AncungAulia/tibaprotocol-monad"

// The ShipmentManager proxy on Monad testnet, from sc/deployments/10143.json.
export const CONTRACT_URL =
  "https://testnet.monadscan.com/address/0x050693339be3164A4B07C1cca4280a910B5b17FE"
