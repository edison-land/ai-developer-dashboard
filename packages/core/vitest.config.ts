import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    // node:sqlite (and any future node: built-in newer than Vite's built-in
    // list) must be externalized, not resolved as packages.
    server: {
      deps: {
        external: [/^node:/],
      },
    },
  },
});
