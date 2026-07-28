/**
 * Browser-safe barrel: types, labels, pure helpers. Safe to import from the UI
 * (no node-only modules, no native deps). Node-only code (adapters, store, fs)
 * lives under `@ai-dashboard/core/node`.
 */
export * from "./domain.js";
export * from "./paths.js";
export * from "./adapters/types.js";
export * from "./activity.js";
export * from "./focus.js";
