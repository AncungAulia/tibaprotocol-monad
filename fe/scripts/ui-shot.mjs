// Full-page screenshots of the UI preview (pnpm preview:ui) at a real device width.
// Usage: node scripts/ui-shot.mjs <outDir> <width> <name=path> [name=path ...]
//   node scripts/ui-shot.mjs shots 390 home=/payer?s=payer detail=/payer/shipments/1041?s=payer
// Width < 600 emulates a phone (touch, mobile viewport). Needs Google Chrome installed.
// Set CHROME_PATH if Chrome is not in the default location, PREVIEW_URL if not on port 3100.
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const [outDir, width, ...pairs] = process.argv.slice(2)
if (!outDir || !width || !pairs.length) {
  console.error("usage: node scripts/ui-shot.mjs <outDir> <width> <name=path> ...")
  process.exit(1)
}
const base = process.env.PREVIEW_URL ?? "http://localhost:3100"
const chrome =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => existsSync(p))
mkdirSync(outDir, { recursive: true })

const port = 9300 + Math.floor(Math.random() * 500)
const proc = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(tmpdir(), `ui-shot-${port}`)}`,
  "about:blank",
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    target = list.find((t) => t.type === "page")
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener("open", r, { once: true }))
let id = 0
const pending = new Map()
const events = []
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method) events.push(msg.method)
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id
    pending.set(n, resolve)
    ws.send(JSON.stringify({ id: n, method, params }))
  })

const w = Number(width)
const mobile = w < 600
const height = mobile ? 844 : 900
await send("Page.enable")
await send("Emulation.setDeviceMetricsOverride", { width: w, height, deviceScaleFactor: 1, mobile })
if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true })

for (const pair of pairs) {
  const name = pair.slice(0, pair.indexOf("="))
  const path = pair.slice(pair.indexOf("=") + 1)
  events.length = 0
  await send("Page.navigate", { url: base + path })
  for (let i = 0; i < 300 && !events.includes("Page.loadEventFired"); i++) await sleep(200)
  await sleep(6000) // client render, map tiles, fonts
  const { result } = await send("Page.getLayoutMetrics")
  const full = Math.ceil(result.cssContentSize.height)
  const shot = await send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 80,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: w, height: Math.max(full, height), scale: 1 },
  })
  writeFileSync(
    join(outDir, `${name}-${mobile ? "mobile" : "desktop"}.jpg`),
    Buffer.from(shot.result.data, "base64"),
  )
  console.log(`${name}-${mobile ? "mobile" : "desktop"}`)
}
ws.close()
proc.kill()
