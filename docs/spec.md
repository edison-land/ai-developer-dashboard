# AI Developer Dashboard — Product Spec (PRD)

> 本文件由开发计划（`~/.claude/plans/codex-claudecode-ai-claudecode-codex-gi-prancy-crown.md`）与当前代码实测状态综合而成，作为项目的事实来源（source of truth）。内容会随实现演进更新。

## Problem Statement

资深 AI 开发者同时用 Claude Code 和 Codex 跑很多项目，每个工具各自在本地维护一份散落的状态。每天早上都要面对同一个没有好答案的问题：**今天该做哪个项目、每个项目到了哪一步、下一步具体做什么？** 状态被切碎在 `.claude.json`、Codex 的 `state_5.sqlite`、以及每个项目各自的 git 仓库里，要决定今天花时间在哪，只能手动挨个打开工具。此外，任何 AI 辅助总结都必须**严格控成本**，保证日常使用便宜到可以一直开着。

## Solution

一个**本地优先、单用户**的网页应用，把 Claude Code、Codex、git 三源信号统一聚合成一块看板。

- **机械信号**（最后活跃、busy 会话、git 分支/脏文件/ahead-behind/最近提交）直接从本地文件拉取，**免费、始终可用**。
- **语义信号**（阶段、一句话总结、下一步、阻塞）由用户自带的便宜模型**按需**合成，配合内容哈希缓存——输入没变就跳过 API，重复调用不重复付费。预期日成本：15 个项目每天全刷 ≈ **$0.03–0.12**；仅按需则接近零。
- 数据**绝不出本机**。
- 形态先做**本地网页应用**（`pnpm start` / `npx ai-dashboard` → 浏览器开 localhost），分层上为后续 **Electron 包壳**预留，核心零改动即可复用。

## 真实数据快照（本机，2026-07-27 实测）

环境：Node 24.15 / pnpm 10 / 服务 `127.0.0.1:7777` / dataRoot `C:\Users\57652\.ai-dashboard\dashboard.db` / Claude Code 可用 / **Codex `state_5.sqlite` 可用** / git 可用。`GET /api/projects` 实测返回 **13 个 CC 项目**：仅 1 个 `today`（本看板自身）、当前 0 个 busy、其余皆 `stale`。

| # | 项目 | 桶 | 最后动作（截断） | CC 历史花费 | git 一句话 | transcript 尾 |
|---|---|---|---|---|---|---|
| 1 | ai-developer-dashboard | today | — | — | ❌ 非 git 仓库 | — |
| 2 | PolyU | stale | 帮我写 gitignore…忽略…图片 | $12.38 | main·"Confirmation Report"·dirty 228 | ✓ |
| 3 | C:/Users/57652 | stale | claude code 里多选文字删除 | $0 | ❌ 非 git 仓库 | ✓ |
| 4 | lazzy_candy | stale | 'v0.2' | — | main·"'v0.2'"·dirty 50 | — |
| 5 | 52686 课件 week1-7 | stale | — | — | ❌ 非 git 仓库 | — |
| 6 | Desktop | stale | — | $0.39 | ❌ 非 git 仓库 | ✓ |
| 7 | 食谱推荐本科毕设 | stale | — | $9.96 | ❌ 非 git 仓库 | ✓ |
| 8 | AIsongchen | stale | — | $22.73 | ❌ 非 git 仓库 | ✓ |
| 9 | AIsongchen/exhibition-kiosk | stale | — | $0 | ❌ 非 git 仓库 | ✓ |
| 10 | PolyU/研究文件/博士课题 | stale | Confirmation Report | $1.01 | main·dirty 228 | ✓ |
| 11 | Agent RA2 | stale | docs(phase2): record RA2 adaptation smoke pass | $58.60 | main·"…smoke pass"·dirty 2·无 upstream | ✓ |
| 12 | Agent RA2/work/OpenRA-RL | stale | Merge pull request #100… | $0 | main·dirty 0 | ✓ |
| 13 | btc-bear-market-dashboard | stale | Create standalone web dashboard repository | $4.58 | main·"Create standalone…"·dirty 1 | ✓ |

**关键观察（直接影响实现）**：

- **CJK 路径 4 个**（`课程辅导/文件/博士课题/食谱推荐…`），对应的 lossy 文件夹名如 `D--------------------`、`D----------AIsongchen`——印证路径规则"**仅 encode 定位、绝不 decode**"。
- **7 个非 git 仓库**，git 适配器全部优雅返回 `gitError`、不抛错（已验证）。
- 表中"CC 历史花费"是各项目用 Claude Code 的**历史累计开销（≈ $110 合计）**，仅作体量参考；**与本看板的合成成本无关**——后者由按需合成 + 缓存控制，见下。
- **合成冒烟最佳真实目标**（三者同时具备 `lastAction` + transcript 尾 + git）：**`D:/Agent RA2`、`D:/PolyU`、`D:/btc-bear-market-dashboard`**。冒烟默认就跑这三个。

## User Stories

1. 作为开发者，我希望每天打开一个页面就能看到我所有正在推进的项目，这样不用挨个打开工具。
2. 作为开发者，我希望项目按活跃度分桶（🔥 正在进行 / ⏰ 今天活跃 / ❄ 需要关注），这样一眼看出哪些热、哪些被冷落。
3. 作为开发者，我希望看到当前哪些会话处于 busy 状态，这样我知道后台还在跑什么。
4. 作为开发者，我希望每张卡显示"最后一条 prompt / 动作"，这样我能快速回忆上下文。
5. 作为开发者，我希望看到每个项目的最后活跃时间，这样能揪出久未动的项目。
6. 作为开发者，我希望项目按 5 个阶段（想法/开发中/待验证/完成/搁置）排成看板列，这样了解整体管线健康度。
7. 作为开发者，我希望手动覆盖某个项目的阶段，这样我的判断优先于 AI。
8. 作为开发者，我希望清除覆盖、回到自动/AI 阶段判定。
9. 作为开发者，我希望看到某张卡的阶段是来自我的覆盖还是 AI 合成。
10. 作为开发者，我希望点一个按钮就拿到某项目的 AI 总结（阶段/下一步/阻塞），这样不用去翻会话记录。
11. 作为开发者，我希望输入没变时跳过重新合成，这样不为同样的结果付两次钱。
12. 作为开发者，我希望看到缓存的总结何时变 stale（底层输入变了），这样知道该重新总结。
13. 作为开发者，我希望合成失败时优雅降级（显示缓存/旧值），UI 绝不崩。
14. 作为开发者，我希望看到 token/成本被显式约束，这样我信任成本控制。
15. 作为开发者，我希望选择模型提供商（Anthropic / OpenAI）和具体模型。
16. 作为开发者，我希望粘贴自己的 API Key，且 Key 只存在本机、永不被任何接口回显。
17. 作为开发者，我希望设置自动刷新间隔（0 = 关）。
18. 作为开发者，我希望开关"刷新时一并总结"。
19. 作为开发者，我希望 Claude Code + Codex + git 三源按 canonical path 合并成"每个项目一张卡"。
20. 作为开发者，我希望看到每张卡的来源徽标（CC / Codex / Git），这样知道这项目用了哪些工具。
21. 作为开发者，我希望每张卡显示 git 分支 / 脏文件数 / ahead-behind / 最近提交。
22. 作为开发者，我希望看到一条合并后的跨项目活动时间线（Phase 5）。
23. 作为开发者，我希望在一条信息流里看到近期 commits / Codex 线程 / CC 历史。
24. 作为开发者，我希望即使每天全量刷新，日成本也稳在 ~$0.12 以内，这样我敢一直用。
25. 作为开发者，我希望 AI 只在"点按钮"或"定时"时触发，绝不在每轮流式触发，这样成本可预测。
26. 作为开发者，我希望所有数据留在本机，绝不外泄。
27. 作为开发者，我希望 CJK / 空格 / 反斜杠 / `\\?\` 前缀的路径都被正确处理与展示。
28. 作为开发者，我希望日后能把它包成桌面应用（Electron）而不重写核心。
29. 作为用户，我希望 `pnpm start` 后自动开浏览器、落地即用。
30. 作为开发者/调试者，我希望有个 health 端点显示检测到的 CC 项目数 / Codex 线程数 / git 可用性。
31. 作为用户，当看板服务连不上或出错时，我希望看到**具体、可操作**的错误提示（区分"连不上服务" vs "服务内部出错"），并带重试，而不是一句永远相同的套话。

## Implementation Decisions

### 分层架构（pnpm monorepo）

- **core**：纯 TypeScript，**不依赖 `node:http` / react**。可复用的心脏——领域模型、路径处理、聚合、总结编排、适配器、存储。Electron 主进程日后直接 import，零重写。
- **server**：**唯一**耦合 HTTP（Hono）+ LLM 调用 + spawn git 的层；同时托管构建后的静态 UI。
- **ui**：Vite + React 18 + Tailwind v3，构建成静态产物交给 server 托管；数据层用 TanStack Query v5。
- **cli**：`npx ai-dashboard` 入口——解析 argv、起 server、开浏览器。
- **electron**：仅占位，Phase 6 再做。

### 数据源与合并规则

- 三源按 **canonical path**（正斜杠、去 `\\?\`、盘符大写、去尾斜杠）合并成单卡。
- `lastActiveMs = max(各源)`，git head 日期兜底。
- `recencyBucket`：任一 CC 会话 busy → `active-now`；否则按年龄（≤3 天 `today`，>3 天 `stale`）。
- `lastActionOneLiner` 优先级：CC `lastSessionFirstPrompt` > Codex `first_user_message` > git commit subject。
- `liveStatus` 仅来自 CC 会话（仅 `status === "busy"` 点亮 active-now）；git 字段仅来自 git 适配器。
- `stage`：**手动 override > 缓存的 synth > undefined**；`synthStale = (synth.inputHash !== 当前 inputHash)`。
- 路径变换 **lossy 不可逆**（CC 项目文件夹名 encode 后 CJK/空格→`-`）：**只能 encode 定位、绝不 decode**，真实 cwd 从记录内部读。

### 领域模型（决策性类型形状）

```ts
type Stage = 'idea' | 'building' | 'verifying' | 'done' | 'stalled';
type SourceId = 'claude-code' | 'codex' | 'git';

interface RawSignals {            // 单适配器对单项目的贡献，字段可缺
  source: SourceId; canonicalPath: string;
  lastActiveMs?: number; lastActionOneLiner?: string;
  liveStatus?: 'busy' | 'idle';
  gitBranch?: string; gitSha?: string; gitOriginUrl?: string;
  tokensUsed?: number; costUsd?: number;
  transcriptTailPath?: string;    // 给总结层惰性读，聚合时不读
}

interface StatusSnapshot {        // git 快照
  branch: string; headSha: string | null;
  headCommit?: { subject: string; author: string; dateMs: number };
  dirtyFileCount: number;
  aheadBehind: { ahead: number; behind: number; hasUpstream: boolean };
  gitError?: string;              // 非 git 仓库 / 缺 upstream 不抛错，仅静默展示
}

interface SynthResult {
  stage: Stage; summary: string; nextStep: string; blockers: string[];
  model: string; provider: 'anthropic' | 'openai';
  generatedAtMs: number; inputHash: string;
  tokenUsage?: { input: number; output: number; cachedRead?: number };
}

interface UnifiedProject {        // 看板渲染单元
  canonicalPath: string; displayPath: string; name: string;
  sources: SourceId[];
  lastActiveMs: number; recencyBucket: 'active-now' | 'today' | 'stale';
  liveStatus: 'busy' | 'idle' | 'none';
  lastActionOneLiner?: string; git?: StatusSnapshot;
  stage?: Stage; stageSource?: 'synth' | 'override';
  synth?: SynthResult; synthStale: boolean;
  signalsBySource: Partial<Record<SourceId, RawSignals>>;
}
```

### AI 总结层（成本控制的核心）

- **有界输入 bundle**（目标 ≤1.8k token）= 最后用户 prompt（≤300 字符）+ 会话 jsonl 尾部最后 1–2 条 `type ∈ {user,assistant}` 记录（文本截断 ≤600 字符，**流式只读尾、绝不读全文**）+ git（最近 commit subject + `status --short` 文件列表 ≤20 行 + 分支 + ahead/behind）。
- **强校验 schema**：zod 强制 `{ stage, summary(≤280), nextStep(≤200), blockers[](≤5) }`。
- **Provider 抽象**：`SynthProvider` 接口；Anthropic 用 `system:[{text, cache_control:ephemeral}]` **缓存系统 prompt**（cache_read ≈ 10% 成本，是重复调用降本的关键杠杆），默认 `claude-haiku-4-5`，max_tokens 512，temperature 0；OpenAI 用 `response_format:{type:'json_object'}`，默认 `gpt-4o-mini`。用**裸 `fetch` 而非 SDK**，避免再引入一个需要在 Node 24 上编译/对齐的依赖。
- **内容哈希缓存**：`inputHash = sha1(lastActiveMs | git.headSha | dirtyFileCount | lastActionOneLiner)`；hash 未变 → 直接返回缓存，跳过 API；调用失败 → 返回缓存或 null，**绝不崩 UI**，卡片上提示错误。
- **触发**：仅用户点按钮 / `synthesize-all`（仅非 stale）/ 可选定时（默认关）。绝不在每轮流式触发。

### 持久化（`~/.ai-dashboard/dashboard.db`，WAL，幂等迁移）

```sql
CREATE TABLE synth_cache (
  canonical_path TEXT PRIMARY KEY, input_hash, result_json,
  model, provider, generated_at_ms
);
CREATE TABLE stage_overrides (canonical_path TEXT PRIMARY KEY, stage, updated_at_ms);
CREATE TABLE settings (key TEXT PRIMARY KEY, value);
-- settings keys: provider, model, anthropic_api_key, openai_api_key,
--                auto_refresh_mins(0=关), synth_on_refresh, synth_model_pref
```

不存会话内容；API **永不回显** key（仅 `hasAnthropicKey` / `hasOpenAIKey` 布尔）。

> **重要偏离（相对初版计划）**：初版计划假设用 `better-sqlite3`（"Node24/win32-x64 有预编译"）。实测本机 Node 24 编不出 better-sqlite3，**改用 Node 24 内置的 `node:sqlite`（`DatabaseSync`）**，免原生编译；Codex 库以 `{ readOnly: true }` 打开，避免与 Codex 写进程争用。Phase 2 的 Codex 只读访问与预算测试都按 `node:sqlite` API 实现。

### HTTP API 契约（Hono，Windows 路径用 base64url 作 `:enc`）

| 方法 + 路径 | 作用 |
|---|---|
| `GET /api/health` | liveness + 检测到的 CC 项目数 / Codex 线程数 / git 可用性 / dbPath |
| `GET /api/projects` | 全部看板（机械信号，无 AI） |
| `GET /api/projects/:enc` | 单项目深视图（含尾部预览） |
| `POST /api/refresh` | 重跑适配器（机械刷新，无 AI） |
| `POST /api/projects/:enc/synthesize` | 单项目按需总结（命中缓存则跳过） |
| `POST /api/synthesize-all` | 批量（仅非 stale，`?includeStale=true`） |
| `PATCH/DELETE /api/projects/:enc/stage` | 手动阶段覆盖 / 清除 |
| `GET/PUT /api/settings` | provider/model/key 是否存在 / 刷新间隔（永不回显 secret） |
| `GET /api/activity` | 统一活动流（CC history + Codex 近期线程 + git commits） |

UI 错误路径：失败的 API 请求被归类为 `network` / `http` / `parse` 三种结构化错误，UI 据此给出"连不上服务 / 服务返回错误(含真实 cause) / 响应格式异常"的可操作提示 + 重试；服务端 `onError` 把抛出错误的真实 cause 以 JSON `{error, message}` 返回（本机单用户，可安全暴露内部信息）。

### 并发与 Windows 处理

- git spawn 并发上限 **6**，`windowsHide:true`，`execFile` argv（**绝不拼 shell 字符串**），`core.quotepath=false` + 强制 UTF-8 env。
- `log -1` 用 `%x1f` 分隔一次拿 subject/author/date；`rev-list --left-right --count @{u}...HEAD` 取 ahead/behind，无 upstream → `{0,0}` + flag（非错误）。
- 永不打开 `logs_2.sqlite`（~447MB）；jsonl 仅流式读尾。

## Testing Decisions

**哲学**：只测外部行为，不测实现细节；跨越代码库的测试缝（seam）越少越好，理想是**一个主缝**。

- **主缝 = HTTP 层 `createApp(deps).request(...)`**：依赖通过 `ServerDeps`（`config` / `store` / `collect` / `uiDir`）注入，可在不碰真实文件/网络/Key 的情况下驱动任意端点。这是已建立的最高集成缝（见现有 `app.test.ts`：注入假 `collect` 断言 `/api/projects`、断言 stage 400、settings 不回显 key 等）。**Phase 3 的总结端点沿此缝扩展**：把 `SynthProvider` + `TailReader` 加入可注入依赖，用假 provider 断言"命中缓存跳过 API / 失败降级 / 返回 JSON 形状"。
- **纯函数缝**：路径规范化、聚合合并、bundle 组装、inputHash、zod 校验等无副作用逻辑，直接对函数单测（现有 `paths.test.ts` / `aggregate.test.ts` 的先例）。这是它们的最高缝。
- **DI 假实现**：`SynthProvider` / `TailReader` / `Store` 都是接口，测试注入内存版假实现，绝不打真网络或读真 Key。
- **真实数据校验（人工/冒烟，非常规 CI）**：对本机 13 个 CC 项目跑 `collect()`，断言合并成单卡、CJK 路径与非 git 仓库被正确处理（已在上文快照验证）。

### 自动化冒烟（填好 key 后一键执行）

目标：用户在「设置」里填入 provider + model + API Key 后，**一条命令**跑完真实端到端冒烟，无需任何手动步骤。

- **Key 来源（安全）**：用户只在「设置」页粘贴 Key，存入 `~/.ai-dashboard/dashboard.db` 的 settings 表。**冒烟脚本通过 `store.getApiKey()` 读 Key；Claude/我绝不接触 Key 明文。**
- **一条命令**：`pnpm smoke:synth` → 映射到一个 `scripts/smoke-synth.ts`。它复用 store 读 settings，对真实目标直接调 `SynthProvider`（或打 `POST /api/projects/:enc/synthesize`），再读 `synth_cache` 校验缓存。
- **真实目标**：上表 3 个项目——`D:/Agent RA2`、`D:/PolyU`、`D:/btc-bear-market-dashboard`（皆具备 lastAction + transcript 尾 + git）。
- **自动断言**（任一失败 → 非零退出，CI 不跑）：
  1. 每项目首次合成的 bundle `input < 2500` token（验证有界输入）；
  2. 同输入第二次合成命中缓存：`cachedRead > 0` **且**不再产生新 output 计费（prompt caching + content-hash 双保险）；
  3. 返回通过 zod schema（`stage / summary / nextStep / blockers`）；
  4. 3 项目首轮合计估算 `< $0.02`。
- **输出**：逐项目打印 `stage / nextStep / blockers / input·output·cachedRead token / 估算 $`，附总计行；失败项目打印 provider 原始错误（本机单用户，可安全暴露内部信息）。
- **前提**：Phase 3 合成层先落地（当前未实现，见 Further Notes）。该脚本随 Phase 3 一同交付。
- **前端**：UI 目前无测试基建，错误归类等纯逻辑保持为可独立测试的纯函数（`describe(err)`），日后引入 vitest 时无需重构。

## Out of Scope

- 云端 / 多机同步 / 分享（单机本地，日后再议）。
- 流式 / 每轮触发的 AI（与成本控制根本冲突）。
- Electron 桌面壳（Phase 6，后置）。
- 拖拽改阶段（v1 用 `<select>`，`@dnd-kit` 后续再加）。
- 读取 Codex 的 `auth.json` / `secrets/` / `.sandbox-secrets/` / `logs_2.sqlite`（安全 + 体积，永不碰）。
- 修复 `packages/core` 现存的类型告警（`DatabaseSync` 类型用法、`auto_refresh_mins` snake_case）——非阻塞，独立任务。

## Further Notes

### 当前进度（截至本文件撰写）

| Phase | 范围 | 状态 |
|---|---|---|
| 1 · 机械核心 | CC + git 适配器、聚合、store、Hono 服务、React UI、CLI | ✅ 完成并验证（13 个真实 CC 项目在跑） |
| 2 · Codex 适配器 + 三源合并 | readonly 打开 `state_5.sqlite`、config.toml 种子、`\\?\` strip、case-normalize | ⏳ 未做（仅 health 探测 `codexAvailable`） |
| 3 · 总结层 + 成本控制 | bundle / schema / providers / synth、synthesize 端点、按钮、缓存 | ⏳ 未做（仅 domain 接口 + store 存取） |
| 4 · 阶段看板 + 覆盖 | KanbanView 5 列、stage PATCH/DELETE | 🟡 UI + override 完成；"synth 来源"等 Phase 3 |
| 5 · 活动视图 + 定时刷新 + 打磨 | ActivityView 合并、auto-refresh、空态/错误、路径打磨 | 🟡 仅壳（`/api/activity` 返回空） |
| 6 · Electron 壳 | 主进程 import server + loadURL、electron-builder | ⏳ 未开始 |

### 关键风险与对策（摘要）

1. Codex schema 漂移（已证实，真实列与假设不同、CLI 版本会变）→ 启动 `PRAGMA table_info` 探测、缺列降级告警、不绑 CLI 版本。
2. CC 文件夹名 lossy → 仅 encode 定位、cwd 从记录内读。
3. 路径分隔符 / CJK / 编码 → 内部统一正斜杠、git argv + UTF-8 env、sqlite 文本显式 utf8。
4. sqlite 只读并发 → Codex 库 `readOnly`、不长持有；自有库 WAL。
5. 密钥安全 → 不读 Codex auth/secrets；自有 key 存 settings 表、API 永不回显。

### 成本预算

15 项目每天全刷 ≈ $0.03–0.12（Haiku 默认 + prompt caching + content-hash 缓存）；仅按需触发则接近零。冒烟断言：`/api/synthesize-all` 在缓存加持下 < $0.02。
