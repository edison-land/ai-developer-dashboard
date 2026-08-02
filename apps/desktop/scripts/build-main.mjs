import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");

await build({
  entryPoints: [path.join(appDir, "src", "main.ts")],
  outfile: path.join(appDir, "dist", "main.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  sourcemap: true,
  external: ["electron"],
  define: {
    "import.meta.url": "__filename",
  },
  logLevel: "info",
});
