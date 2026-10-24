// Bundles the server into dist/index.js. npm dependencies stay external (installed at runtime);
// the workspace package @tiba/sc ships TypeScript source, so it is inlined.
import { build } from "esbuild"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@tiba/"))

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external: [...external, ...external.map((name) => `${name}/*`), "pino-pretty"],
  logLevel: "info",
})
