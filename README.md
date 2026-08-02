# AI Developer Dashboard

A local-first AI developer dashboard for Claude Code, OpenAI Codex, and Git. It helps you triage AI coding projects, track project status, review recent activity, and decide what to work on next.

> **中文简介：** AI Developer Dashboard 是一个运行在本机的 AI 编程项目工作台。它按项目汇总 Claude Code、OpenAI Codex 和 Git 的活动，帮助你判断今天推进什么、项目处于什么阶段，以及下一步该做什么。

## What problem does it solve?

Claude Code sessions, Codex tasks, and Git commits each record a different part of your development work. When you maintain several local projects, reconstructing progress and priorities takes time.

AI Developer Dashboard groups those signals by project path and gives you one project triage view:

- Which projects need attention today?
- What stage is each project in?
- What concrete action should come next?

## Key features

| Feature | What it does |
|---|---|
| Today focus | Selects up to three priority projects. You can pin, reorder, or hide a project for the day. |
| Project management | Provides list and stage-board views with search, source filters, time filters, stage overrides, details, archive, and restore. |
| Local signal aggregation | Merges Claude Code, OpenAI Codex, and Git activity by canonical project path. |
| AI project summaries | Generates a stage, summary, next step, blockers, and attention state when you request it. The implemented provider is Zhipu GLM. |
| Cost controls | Caches summaries by input hash and shows item-level progress during batch runs. |
| Activity timeline | Combines recent actions from Claude Code, OpenAI Codex, and Git. |
| Local preferences | Stores focus choices, stages, archives, filters, theme, and refresh settings on your computer. |

## How it works

```text
Claude Code + OpenAI Codex + Git
                 |
         project path matching
                 |
       local project state store
                 |
      focus, projects, and activity
                 |
       optional AI project summary
```

1. Local adapters read project metadata from Claude Code, OpenAI Codex, and Git.
2. The core package normalizes paths and merges records that belong to the same project.
3. The local server stores dashboard state in `~/.ai-dashboard` and serves the React interface.
4. An AI summary request builds a capped prompt from recent project context and a compact Git snapshot.

## Privacy and AI usage

> [!IMPORTANT]
> Normal project collection and dashboard browsing stay on your computer. The dashboard does not upload project source files.

AI summaries require a configured model service. When you request a summary, the dashboard sends a bounded prompt that can contain:

- a truncated recent instruction;
- up to two recent Claude Code transcript turns;
- the Git branch, latest commit subject, worktree counts, and a small sample of changed filenames.

The dashboard stores API keys in its local data store and does not return them through the settings API. You can use project collection, filters, stages, archives, and activity views without an API key. AI summaries remain unavailable until you configure one.

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- [pnpm](https://pnpm.io/) 10
- Git

Claude Code and OpenAI Codex are optional data sources. The dashboard still starts when one source is absent.

### Install and run

```bash
git clone https://github.com/DrErwin/ai-developer-dashboard.git
cd ai-developer-dashboard
pnpm install
pnpm build:ui
pnpm start
```

The command starts the local service and opens the dashboard in your browser.

### Development

Run the server and UI in separate terminals:

```bash
pnpm --filter @ai-dashboard/cli dev
pnpm --filter @ai-dashboard/ui dev
```

- Local server: `http://127.0.0.1:7777`
- Vite development UI: `http://127.0.0.1:5173`

## Current status

> [!NOTE]
> The local web MVP is ready for ongoing use. The project does not provide an Electron desktop installer yet.

| Area | Status |
|---|---|
| Local web dashboard | Available |
| Claude Code, OpenAI Codex, and Git aggregation | Available |
| AI summaries through Zhipu GLM | Available after API key setup |
| Generic OpenAI-compatible provider settings | Planned for v0.9.1 |
| Electron desktop application | Deferred |

See the [versioned documentation](docs/README.md) for completed milestones, planned work, and known gaps.

## FAQ

### What is AI Developer Dashboard?

AI Developer Dashboard is a local-first project triage tool for developers who work across several AI coding projects. It combines Claude Code, OpenAI Codex, and Git signals in one browser-based dashboard.

### Does it upload source code?

No. Project collection reads local metadata and does not upload source files. An AI summary sends the bounded context listed in [Privacy and AI usage](#privacy-and-ai-usage) to the model service you configure.

### Which AI coding tools does it support?

The dashboard reads local project activity from Claude Code and OpenAI Codex, then combines it with Git repository state. Zhipu GLM provides the implemented AI summary service. Other model providers remain planned work.

### Can it run without an AI model?

Yes. You can collect and browse projects, manage stages and archives, use filters, and review activity without an API key. AI-generated summaries require a configured model.

## Verification

Run the release verification entry point:

```bash
pnpm verify:ui-redesign
```

It runs workspace type checks, automated tests, and the production UI build.

Two focused checks are also available:

```bash
pnpm smoke:synth       # Call the model configured on this computer
pnpm qa:live-progress  # Run the batch-progress demo without a model call
```

## Project structure

```text
packages/core    Project data, path merging, focus rules, AI summary orchestration, and local storage
packages/server  Local HTTP API, model integration, and static UI hosting
packages/ui      React dashboard
apps/cli         Local service launcher and browser entry point
scripts          Release verification and focused smoke checks
docs             Product requirements, milestone status, and design records
```

## Documentation

- [Versioned documentation](docs/README.md): requirements, completion status, and the next milestone.
- [Market research](docs/market-research.md): the AI coding multi-session, agent dashboard, orchestration, and agentic IDE landscape as of July 31, 2026.
- [v0.9.0 troubleshooting](docs/versions/v0.9.0/troubleshooting.md): historical web/CLI startup, data-source, database, and model failures.
- [v0.9.0 release checklist](docs/versions/v0.9.0/release-checklist.md): historical web/CLI automated, live-model, and visual review checks.
