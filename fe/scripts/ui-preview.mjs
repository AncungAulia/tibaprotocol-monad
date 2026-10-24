// Dev-only UI preview: every real route with sample data and no sign-in.
//   pnpm --filter @tiba/fe preview:ui   then open http://localhost:3100/payer?s=payer
// Scenarios live in src/dev/preview/scenarios.ts (payer, payer-new, payer-overdue, payer-review,
// carrier, warehouse, investor, investor-new, new).
import { spawn } from "node:child_process"
import { createRequire } from "node:module"

const next = createRequire(import.meta.url).resolve("next/dist/bin/next")
const child = spawn(process.execPath, [next, "dev", "--port", "3100"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_UI_PREVIEW: "1", NEXT_DIST_DIR: ".next-preview" },
})
child.on("exit", (code) => process.exit(code ?? 0))
