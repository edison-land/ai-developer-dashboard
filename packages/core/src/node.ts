/**
 * Node-only barrel: everything the server/orchestrator needs. Imports node
 * built-ins (fs, child_process, node:sqlite, node:crypto) — never import from
 * the browser bundle.
 */
export * from "./index.js";
export * from "./config.js";
export * from "./aggregate.js";
export * from "./dashboard.js";
export * from "./adapters/claudeCode.js";
export * from "./adapters/git.js";
export * from "./store.js";
