# AI Developer Dashboard

A local project kanban / triage board for developers juggling many projects across AI coding
tools (Claude Code, Codex). Answers: *which project should I work on today, what stage is each
at, and what's the next step?*

- **Local-first.** Reads `.claude.json`, Codex `state_5.sqlite`, and `git` directly from disk.
  Data never leaves your machine.
- **Cost-controlled AI.** Mechanical signals are always free. Semantic fields (stage / next step /
 blockers) are synthesized **on demand** with a cheap model and content-hash caching — a full daily
 refresh of ~15 projects is well under $0.12.

## Quick start

```bash
pnpm install
pnpm build:ui          # build the React UI once
pnpm start             # start the local server and open the browser
```

For live UI development (HMR), run the backend and the Vite dev server separately:

```bash
pnpm --filter @ai-dashboard/cli dev          # backend on :7777
pnpm --filter @ai-dashboard/ui dev           # vite on :5173, proxies /api -> :7777
```

## Layout

```
packages/core    pure TS: domain, paths, aggregate, synth orchestration (+ /node: adapters, store)
packages/server  Hono HTTP API + LLM providers; serves the built UI
packages/ui      Vite + React + Tailwind
apps/cli         `npx ai-dashboard` entrypoint
```
