# AI 编程多会话管理与 Agent 工作台市场研究

> 调研日期：2026-07-31
> 研究范围：AI 编程多会话管理、Agent 看板、任务编排、个人开发者工作台
> 资料口径：官方官网、官方文档、官方 GitHub 仓库与官方发布公告
> 文档性质：市场事实研究，不包含 AI Developer Dashboard 的最终定位、竞争结论或路线建议

## 1. 研究方法与边界

本报告研究的不是“哪一个 AI 模型写代码更好”，而是围绕多个 AI 编程任务产生的新一层软件：

- 如何同时看见多个项目、会话或任务；
- 如何判断 Agent 正在工作、等待输入、已经完成或发生失败；
- 如何启动、继续、停止和审查 Agent 工作；
- 如何把 Issue、任务卡、会话、分支、worktree 和 Pull Request 连接起来；
- 如何让个人或团队从一个入口管理多个 Agent。

为了避免把营销描述写成已验证结果，本报告采用以下规则：

1. “支持某能力”表示该能力在一手资料中有明确描述，不表示本轮已实际安装验证。
2. “未公开说明”不等于产品一定不支持，只表示当前一手资料不足。
3. 预览、实验性、仅限某个平台、需要特定订阅或需要从源码安装的能力，会单独标明。
4. 不使用第三方评测来推断产品质量、用户规模、收入或市场份额。
5. 市场变化很快，版本、价格、支持的 Agent 和平台状态在使用本报告时仍需重新核对。

## 2. 市场范围与四类产品

截至调研日，这一市场已经不再只有“给终端加一个看板”这一种产品。公开产品大致形成四类。

| 类型 | 核心对象 | 典型入口 | 主要价值 | 代表产品 |
|---|---|---|---|---|
| 原生厂商入口 | 自家 Agent 及其生态内会话 | 官方桌面应用、CLI、IDE、代码托管平台 | 让已有用户并行运行、查看和审查自家 Agent | Codex App、Claude Code Agent View、VS Code Agents Window、GitHub Copilot Agents |
| 跨 Agent 观察与控制工具 | 已有 CLI 会话、终端或运行事件 | 本地网页、终端面板、Hook/遥测 | 把分散在终端和机器上的会话集中显示，部分产品进一步提供启动与控制 | AgentPulse、Code Agent Kanban、CliDeck |
| 项目与任务编排平台 | Issue、任务卡、队列和 Agent 执行 | 看板、Issue、项目空间 | 先记录和分派工作，再由不同 Agent 执行，并把结果回写 | Multica、Dispatch、Kandev、Vibe Kanban |
| 完整 Agent IDE / 开发环境 | Agent 会话与整个代码工作空间 | 独立桌面开发环境 | 把会话、文件、终端、Git、审查、浏览器和自动化放进同一工作环境 | Jaade、Google Antigravity；Dispatch 也与此类重叠 |

四类之间并非互斥。最明显的市场变化是边界正在融合：

- 观察工具开始加入会话启动、重试、收件箱和自动判断；
- 看板工具开始加入终端、worktree、diff 审查和 Pull Request；
- IDE 开始加入跨项目的 Agent 管理器；
- 原生厂商入口开始支持多个 Agent、多个项目、远程访问和自动化。

## 3. 主要产品事实

### 3.1 原生厂商入口

#### OpenAI Codex App

OpenAI 将 Codex App 定义为管理多个 Agent 的“command center”。公开能力包括：

- 按项目组织多个线程，并行运行多个 Codex Agent；
- 在线程内查看变更、评论 diff，并可在编辑器中打开；
- 内置 Git worktree，让同一仓库上的多个 Agent 在隔离副本中工作；
- 继承 Codex CLI 和 IDE 扩展的会话历史与配置；
- 提供 Skills 与 Automations；
- Codex 已进入 ChatGPT 移动端预览，可从手机查看并介入不同电脑、开发机或远程环境上的活动工作；
- macOS 首发，官方页面记录 Windows 版已于 2026-03-04 提供。

来源：[OpenAI：Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)、[OpenAI：Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)。

公开边界：

- 这是 Codex 原生入口，不是任意第三方 CLI Agent 的统一观察器；
- 多 Agent、worktree、diff 审查和自动化都发生在 Codex 生态中；
- 官方资料没有把它描述为通用 Issue 看板或跨厂商任务管理系统。

#### Claude Code Agent View

Claude Code Agent View 是终端内的多会话管理界面。官方文档明确说明：

- `claude agents` 显示所有受 Agent View 管理的后台 Claude Code 会话；
- 会话按“需要输入、工作中、已完成”等状态组织；
- 用户可以查看最近输出、直接回复、进入完整会话或返回总览；
- 可以把当前 Claude Code 会话通过 `/bg` 或左箭头放到后台，也可以用 `claude --bg` 新建后台会话；
- 会话在离开 Agent View 后继续运行；
- 截至调研日仍是 Research Preview，要求 Claude Code 2.1.139 或更高版本。

来源：[Claude Code：Manage multiple agents with agent view](https://code.claude.com/docs/en/agent-view)、[Anthropic 发布说明](https://claude.com/blog/agent-view-in-claude-code)。

公开边界：

- 只管理 Claude Code 会话；
- 主要界面是终端会话列表，不是跨工具项目看板；
- 它能接入用户主动放到后台的现有 Claude Code 会话，但没有公开说明会自动发现其他 Agent 的历史会话。

#### VS Code Agents Window

VS Code Agents Window 是 VS Code 的 Agent-first 独立窗口。官方文档明确说明：

- 从一个窗口访问不同工作区并并行跟踪多个会话；
- 会话列表、聊天、变更面板和 Agent 自定义配置处于同一界面；
- 能读取支持范围内已有的 Copilot CLI、Copilot Cloud 和 Claude Agent 会话；
- 支持重命名、标记完成、置顶、并排打开会话，以及审查文件变更；
- 支持本地文件夹、GitHub 仓库、SSH、Dev Tunnel 和浏览器远程入口；
- Copilot CLI 会话默认可采用 Git worktree 隔离；
- 截至调研日仍处于 Preview。

来源：[Visual Studio Code：Use the Agents window](https://code.visualstudio.com/docs/agents/agents-window)。

公开边界：

- 当前 Agents Window 只支持 Copilot CLI、Copilot Cloud 和 Claude Agent；
- 本地其他第三方 CLI Agent 不能直接出现在这个窗口；
- Copilot Cloud 需要 GitHub 仓库；
- 需要 VS Code 与 GitHub Copilot 访问权限。

#### GitHub Copilot Agents

GitHub 已经把 Agent 管理放进仓库、Issue、Pull Request、移动端和 VS Code 工作流。公开能力包括：

- 在仓库的 Agents 页创建、查看、归档和切换 Agent 会话；
- 把 Issue 分配给 Agent，或在 Pull Request 评论中要求继续修改；
- Agent 在后台环境中工作，用户查看实时日志、diff，并决定何时建立 Pull Request；
- 支持 Copilot Cloud Agent，并允许 Claude 和 Codex 作为第三方 Coding Agent；
- 同一 Issue 可分配给多个 Agent，用于比较不同结果；
- 会话可在 GitHub、GitHub Mobile 和 VS Code 等入口使用；
- Copilot Cloud Agent 已增加计划、代码库研究、分支执行和自动化触发。

来源：[GitHub：Copilot agents 概念](https://docs.github.com/en/copilot/concepts/agents)、[GitHub：第三方 Coding Agents](https://docs.github.com/en/copilot/concepts/agents/about-third-party-coding-agents)、[GitHub：Claude 和 Codex 公共预览公告](https://github.blog/changelog/2026-02-04-claude-and-codex-are-now-available-in-public-preview-on-github/)、[GitHub：Agents 页公告](https://github.blog/changelog/2026-01-26-introducing-the-agents-tab-in-your-repository/)。

公开边界：

- 核心工作对象是 GitHub 仓库、Issue、分支和 Pull Request；
- 第三方 Agent 属于 GitHub 管理范围内的 Agent 执行，不等于自动汇总用户在任意终端里启动的全部会话；
- Claude 与 Codex 的第三方 Agent 支持在官方文档中仍标记为 Public Preview；
- 使用范围受 Copilot 套餐、仓库授权和组织策略影响。

### 3.2 跨 Agent 观察与控制工具

#### AgentPulse

AgentPulse 是开源的 Claude Code 与 Codex CLI 会话控制台。它的官方仓库已经把产品分为两种主要模式：

- Observability：通过 Hook 实时查看 Prompt、响应、进度、备注和会话历史；
- Orchestration：从 AgentPulse 启动和管理无头或交互式会话，支持模板、Supervisor、重试和主机路由。

其他公开能力包括：

- 按项目识别会话，并显示状态、时长和工具调用数量；
- 全文搜索会话名称、Prompt、计划、备注和事件；
- 收件箱聚合审批、卡住或高风险会话警告和近期失败；
- 本地安装、Docker、远程事件汇总和多机器使用方式；
- 通过 MCP 让外部 Agent 读取或控制会话；
- 可选 AI Labs 能对会话标记 `healthy`、`blocked`、`stuck`、`risky` 或 `complete_candidate`，但官方明确标记为实验性；
- Windows、macOS 和 Linux 均有安装说明。

来源：[AgentPulse 官方 GitHub 仓库](https://github.com/jstuart0/agentpulse)。

公开边界：

- 主要原生支持 Claude Code 与 Codex CLI；
- 更主动的 AI 判断与自然语言控制属于可关闭的 Labs 功能；
- Hook、Supervisor、远程部署和权限设置决定了它能观察或控制到什么程度；
- 它已不只是只读看板，因此与任务编排工具的边界正在重叠。

#### Code Agent Kanban

Code Agent Kanban（包名 `claude-kanban`）是面向 Claude Code 与 Codex 会话的实时网页看板。公开能力包括：

- 扫描本机或通过 SSH 扫描多台服务器上的会话日志；
- 以 Running、Completed、Errors 等列显示会话；
- 读取会话的首段和最近消息，并通过本地 Claude 或 Codex CLI 生成任务摘要、进度和估计完成比例；
- 自动刷新并缓存摘要；
- 根据进程和活动状态跟踪会话退出与恢复；
- 通过网页配置 SSH 服务器和 Provider。

来源：[Code Agent Kanban 官方 GitHub 仓库](https://github.com/ShenJiahuan/claude-kanban)、[PyPI 发布页](https://pypi.org/project/claude-kanban/)。

公开边界：

- 公开描述集中在“发现和监控已有会话”，没有说明它能从看板直接向会话发送指令或执行完整 Git 审查；
- 当前支持 Claude Code 与 Codex，配置说明使用单一 Provider 选择；资料未明确承诺在同一视图中混合两类 Provider；
- PyPI 在调研日显示最新版本为 0.3.1，发布日期为 2026-04-09。

#### CliDeck

CliDeck 将自己定义为现有 CLI Agent 上方的本地协调层，而不是替代这些工具。公开能力包括：

- 在一个浏览器页面中运行 Claude Code、Codex、Gemini CLI 和 OpenCode；
- 每个 Agent 使用真实终端面板；
- 显示工作中、空闲、最近消息和完成通知；
- 支持会话恢复、项目分组和 Agent 间通信；
- 可通过插件加入 Agent 工作流路由与移动端中继；
- Agent 状态主要通过本地 OpenTelemetry 事件获得，而不是只解析终端文本；
- 本地 Node.js 服务运行，官方说明数据保留在用户机器上。

来源：[CliDeck 官方文档](https://docs.clideck.dev/)、[CliDeck 官方 GitHub 仓库](https://github.com/rustykuntz/clideck)。

公开边界：

- 它统一的是终端和会话运行界面，不是 Issue/项目管理系统；
- Agent 间自动路由依赖 Autopilot 等插件；
- 官方资料强调从 CliDeck 中运行和恢复会话，没有明确说明能自动纳入所有在外部终端中已存在的历史会话。

### 3.3 项目与任务编排平台

#### Multica

Multica 将自己定义为人和 AI Agent 在同一工作区协作的任务平台。它的核心对象是 Issue，而不是外部会话。公开能力包括：

- Issue 具有标题、描述、状态、优先级、负责人和所属项目；
- Issue 可分配给人或 Agent，Agent 可被 `@` 提及并在评论中汇报进度；
- 七种 Issue 状态：Backlog、Todo、In Progress、In Review、Done、Blocked、Cancelled；
- Inbox 聚合指派、提及、订阅变更、评论和 Agent 失败通知；
- 本地 Daemon 领取任务并调用用户电脑上的 Claude Code、Codex 等 AI 编程工具；
- Agent 的模型、Skills、运行时和会话恢复能力取决于所选工具；
- Autopilot 支持定时、Webhook 和手动触发；
- 提供 Cloud、自托管、桌面端，并公开了 iOS 源码安装方式。

来源：[Multica 工作原理](https://multica.ai/docs/how-multica-works)、[Issues 与 Projects](https://multica.ai/docs/issues)、[Inbox](https://multica.ai/docs/inbox)、[Autopilots](https://multica.ai/docs/autopilots)、[桌面应用](https://multica.ai/docs/desktop-app)。

公开边界：

- Agent 不会无条件自己开始，每次执行由 Issue 指派、评论提及、聊天或 Autopilot 触发；
- Multica Server 保存工作区、Issue、评论和执行记录，本地电脑保存代码目录、工具凭据并负责实际执行；
- 官方明确区分“某次执行结束”和“Issue 业务完成”：执行 Completed 不自动等于工作已完成；
- 公开文档没有把 Multica 描述为自动发现用户在平台外已经启动的全部 CLI 会话。

#### Dispatch

本报告中的 Dispatch 指 `dispatch.codes`。官方文档把它描述为把项目管理与 Agent 开发工具合并在一起的桌面应用。公开能力包括：

- 拖放 Kanban、优先级与标签；
- Claude、Codex、Gemini、OpenCode 和 Droid 多 Agent 编排；
- AI Chat、完整 PTY 终端、Git、worktree 与任务执行；
- 从任务到 PRD、隔离 worktree 和合并的自动循环；
- Telegram、Discord、Slack、WhatsApp 和语音等远程渠道；
- 本地存储项目、对话和看板，可选团队云同步；
- BYOK，即用户提供模型服务的 API Key。

来源：[Dispatch 官方文档](https://dispatch.codes/docs)、[Dispatch 官网](https://dispatch.codes/)。

资料限制：

- 官方首页将产品称为 macOS 原生应用并突出 macOS 下载；文档概览同时写有 macOS、Windows 和 Linux。两处公开资料存在平台可用性表述不一致，不能仅据此确认各平台安装包均处于相同成熟度；
- 多 Agent、Kanban、终端、Git 和通信渠道使其同时属于任务编排平台和完整开发环境；
- 官网能力描述较广，本轮未逐项安装验证。

#### Kandev

Kandev 是开源、自托管的 AI Kanban 与开发环境。官方仓库公开说明：

- 从看板创建任务并为每项任务启动隔离工作区；
- 并行运行多个 Agent，会话可恢复；
- 提供 diff、文件变更、终端、浏览器预览、Git 提交和 Pull Request；
- 通过 Agent Client Protocol（ACP）接入 Claude Code、Codex、Copilot、Gemini CLI、OpenCode、Cursor、Devin、Kimi 等多种工具；
- 支持把外部 Issue 拉入看板，并把任务与 Pull Request 关联。

来源：[Kandev 官方 GitHub 仓库](https://github.com/kdlbs/kandev)。

公开边界：

- 主要流程是从 Kandev 任务启动 Agent 工作区，而不是被动汇总所有外部历史会话；
- 官方仓库将更高自治程度的 Office Mode 标记为 “In progress”，其中的收件箱、审批、预算和持久 Agent 团队不应当作现有稳定能力。

#### Vibe Kanban

Vibe Kanban 曾提供较完整的多 Agent 看板工作流：

- 用 Kanban Issue 规划、排序和分派工作；
- 为 Agent 创建带分支、终端和开发服务器的工作区；
- 支持 10 种以上 Coding Agent；
- 在界面中审查 diff、留下行内意见、预览应用并创建 Pull Request。

来源：[Vibe Kanban 官方 GitHub 仓库](https://github.com/BloopAI/vibe-kanban)。

它同时提供了重要的市场经营样本。2026-04-10，团队官方宣布关闭背后的公司 bloop：

- 项目转为开源和社区维护；
- 官方称每天有数千名软件工程师使用，但绝大多数是免费用户；
- 团队表示未找到令其满意的商业模式；
- 订阅终止，远程服务在公告后的过渡期结束，本地工作区继续运行。

来源：[Vibe Kanban：Goodbye bloop](https://www.vibekanban.com/blog/shutdown)。

这一事实只说明 Vibe Kanban 自身的经营结果，不能单独证明整个类别无法商业化；但它表明“较高使用量”“丰富功能”和“可持续付费”之间并不存在自动关系。

### 3.4 完整 Agent IDE / 开发环境

#### Jaade

Jaade 将自己定义为 Agentic Development Environment。公开能力包括：

- 在同一工作区启动 Claude Code、Codex、OpenCode 和 Cursor；
- 将会话、终端、文件、Git diff、历史、分支、项目、任务板、记忆、Skills、插件与 MCP 放在同一环境；
- 支持会话恢复，并保留 Prompt、模型、分支和改动文件；
- 提供会话结构图，把轮次、工具调用、命令、文件改动和 Agent 任务显示为可展开节点；
- 提供手动、Cron 和间隔自动化；
- 本地运行，官网当前提供 macOS 下载。

来源：[Jaade 官网](https://jaade.app/)。

公开边界：

- Claude Code 与 Codex 被列为一等支持，OpenCode 与 Cursor 在官网 FAQ 中被描述为实验性；
- 当前主要是从 Jaade 工作区启动和管理 Agent，而非仅仅观察所有外部终端；
- 本轮没有找到与 macOS 同等级的 Windows/Linux 官方下载说明。

#### Google Antigravity

Google 将 Antigravity 描述为 Agent-first 开发平台，而不只是代码编辑器。公开能力包括：

- Agent 可跨编辑器、终端和浏览器规划、执行并验证任务；
- Manager 界面可分派后台长任务并异步观察进度；
- Agent 通过任务列表、实现计划、截图和浏览器录屏等 Artifacts 提供可审查结果；
- 用户可直接对 Artifact 留下反馈；
- 官方 Antigravity 2 页面进一步强调多个自主 Agent 跨独立项目并行工作。

来源：[Google Developers Blog：Build with Google Antigravity](https://developers.googleblog.com/en/build-with-google-antigravity-our-new-agentic-development-platform/)、[Antigravity 2](https://antigravity.google/product/antigravity-2)。

公开边界：

- 这是 Google 自有的完整开发平台，不是专门读取其他 CLI Agent 历史的中立看板；
- 公开重点是 Agent 执行与可审查 Artifact，而不是传统 Issue 管理；
- 产品能力和可用范围仍在快速变化。

## 4. 能力矩阵

符号说明：

- `●`：一手资料明确支持；
- `◐`：部分支持、需要特定入口/配置，或只支持有限 Agent；
- `—`：一手资料未说明，或不属于该产品公开主流程；
- “跨 Agent”指支持不止一个厂商或 Agent 运行时，不是同一厂商的多个模型。

| 产品 | 多会话总览 | 跨项目 | 跨 Agent | 纳入已有会话 | 启动/继续/控制 | Issue/任务看板 | Diff/Git/worktree | 自动化 | 本地/自托管 | 远程/移动入口 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Codex App | ● | ● | — | ●（Codex 历史） | ● | — | ● | ● | ● | ◐ |
| Claude Agent View | ● | ◐ | — | ●（主动后台化） | ● | — | ◐ | — | ● | — |
| VS Code Agents Window | ● | ● | ◐ | ●（支持范围内） | ● | — | ● | — | ● | ● |
| GitHub Copilot Agents | ● | ◐（按仓库） | ● | ◐（GitHub 管理会话） | ● | ●（Issue） | ● | ● | — | ● |
| AgentPulse | ● | ● | ●（Claude/Codex） | ●（Hook） | ● | — | — | ◐（部分实验性） | ● | ● |
| Code Agent Kanban | ● | ● | ◐（Claude/Codex） | ●（日志扫描） | — | ◐（状态列） | — | — | ● | ◐（SSH 多服务器） |
| CliDeck | ● | ● | ● | ◐ | ● | — | — | ◐（插件） | ● | ●（插件） |
| Multica | ●（任务执行） | ● | ● | — | ● | ● | ◐ | ● | ● | ● |
| Dispatch | ● | ● | ● | — | ● | ● | ● | ◐ | ● | ● |
| Kandev | ● | ● | ● | — | ● | ● | ● | ◐ | ● | ◐ |
| Vibe Kanban | ● | ● | ● | — | ● | ● | ● | — | ● | 远程服务已停止 |
| Jaade | ● | ● | ● | ◐ | ● | ● | ● | ● | ● | — |
| Google Antigravity | ● | ● | — | — | ● | ◐ | ◐ | — | ◐ | — |

矩阵只能说明公开能力覆盖，不能直接代表产品体验、稳定性或完成度。特别需要注意：

- “纳入已有会话”有三种不同含义：读取同一厂商历史、主动把会话交给管理器、通过 Hook/日志自动观察；这些能力不能视为完全等价。
- “完成”可能表示一次 Agent 运行结束、任务进入待审查、Issue 关闭或 Pull Request 合并；不同产品的含义不同。
- “跨 Agent”常常仍受接入方式限制，例如 VS Code 只接纳规定的 Agent 类型，AgentPulse 主要支持 Claude Code 与 Codex，Multica 和 Kandev 则依赖各工具的运行时能力。

## 5. 市场共同能力

从上述产品可以归纳出一组正在成为基础配置的能力。

### 5.1 多任务可见性

大多数产品至少能显示：

- 会话或任务名称；
- 所属项目或工作区；
- 工作中、等待、完成或失败；
- 最近输出或简短摘要；
- 进入会话或任务详情的入口。

这类能力同时出现在原生厂商、开源观察工具、任务平台和 Agent IDE 中，已经不是单一产品类别独有。

### 5.2 人工介入与审查

“Agent 自动写代码”正在转向“Agent 执行，人类监督”：

- Claude Agent View 把等待输入的会话放在显眼位置；
- VS Code、Codex App、GitHub、Kandev、Dispatch 和 Jaade 都把变更审查靠近会话；
- Multica 用 `in_review` 区分交付与最终完成；
- AgentPulse 用 Inbox 汇总审批、风险和失败。

市场正在形成一个共同原则：Agent 运行结束不应自动等同于业务工作被人接受。

### 5.3 隔离执行与 Git 闭环

worktree、独立分支、diff、Pull Request 和合并已从高级功能逐渐进入常见功能集合。其目的不是增加看板展示，而是让多个 Agent 并行工作时减少互相覆盖，并让用户可以审查后再合入。

### 5.4 从观察走向控制

只读监控产品正在加入：

- 从面板启动 Agent；
- 向会话发送后续指令；
- 停止、重试和恢复；
- 模板化启动；
- 远程审批和移动端通知；
- Agent 间工作流路由。

AgentPulse 和 CliDeck 都体现了这一变化。另一方面，Multica、Dispatch、Kandev 等产品从一开始就以任务驱动执行。

### 5.5 本地执行与远程访问并存

市场没有统一选择“全本地”或“全云端”，而是在组合两者：

- 本地代码与凭据，本地 Agent 执行；
- 云端或自托管服务器记录任务与协作数据；
- 通过网页、移动端、消息渠道或安全中继远程查看和介入。

Codex、VS Code、GitHub、Multica、AgentPulse、CliDeck 和 Dispatch 都以不同方式向这个组合靠近。

## 6. 市场趋势

### 6.1 原生厂商正在占据多会话入口

OpenAI、Anthropic、Microsoft/GitHub 和 Google 都已经提供自己的多 Agent 或 Agent-first 管理入口。用户如果只使用单一生态，原生产品可以直接提供会话总览、并行执行、审查和远程访问。

### 6.2 “跨 Agent”正在成为平台层能力

跨 Agent 不再只由小型第三方工具提供：

- GitHub 在同一平台支持 Copilot、Claude 和 Codex；
- VS Code Agents Window 同时管理 Copilot 与 Claude 的部分会话；
- Multica、Dispatch、Kandev、CliDeck 和 Jaade 都把多个 Agent 运行时作为产品基础；
- ACP、MCP、Hook、OpenTelemetry、CLI 与各厂商 App Server 正在成为接入手段。

但“支持多个 Agent”仍不等于“自动汇总用户所有既有 Agent 工作”，前者通常是平台启动并管理多个运行时，后者是从平台外发现会话。

### 6.3 看板正在演变为开发控制平面

竞争对象正在从简单 Kanban 扩展到：

- Issue 与项目；
- 会话与任务的身份映射；
- Agent 配置和 Skills；
- worktree、终端、diff 和 Pull Request；
- 自动化触发；
- 审批、风险和失败收件箱；
- 远程渠道和移动端。

因此，“有看板”本身无法描述一个产品处于市场的哪一层。

### 6.4 注意力管理开始成为显性功能

多会话数量增加后，产品开始把“什么时候需要人”作为单独问题：

- Claude Agent View 区分 Needs Input；
- AgentPulse 汇总审批、风险、卡住和失败；
- Multica Inbox 汇总指派、提及和失败通知；
- Codex 和 GitHub 增加移动端或远程介入入口。

但各产品仍使用自己的状态、规则和通知体系，尚未形成跨工具统一标准。

### 6.5 商业模式仍在探索

市场中同时存在：

- 大厂订阅内的原生入口；
- 免费开源、本地自托管工具；
- BYOK 桌面应用；
- 按席位或团队协作收费的平台；
- 云端 Agent 使用量与基础设施计费。

Vibe Kanban 的关闭说明，功能丰富和日活跃使用并不能自然转化为可持续收入。官方公告给出的直接原因是绝大多数用户免费使用，团队未找到满意的商业模式。这个样本不能代表所有产品，但说明商业模型本身仍是市场变量。

## 7. 尚未被统一解决的问题

以下问题并不是“市场上完全没有产品尝试”，而是尚未出现被所有类型产品一致解决的方式。

### 7.1 平台外既有会话的统一发现

原生产品通常只能看到自己的会话；跨 Agent 产品也依赖 Hook、日志、遥测、PTY 托管或特定协议。用户在不同终端、IDE、远程服务器和云平台上已启动的所有会话，仍缺少统一、低配置、稳定的发现方式。

### 7.2 不同状态的语义统一

“Idle”“Waiting”“Needs Input”“Completed”“In Review”“Done”“Blocked”并非同一层概念：

- 有的是进程状态；
- 有的是对话状态；
- 有的是 Issue 流程状态；
- 有的是人工验收状态。

把这些状态放进一个总览时，如何避免误报“完成”仍是基础问题。

### 7.3 自动判断“现在需要人做什么”

已有产品开始提供 Needs Input、Inbox、风险标记和失败通知，但仍没有统一规则判断：

- 哪一个会话真正需要立即回应；
- 哪一个只是正常等待；
- 哪一个技术执行结束但需要业务验收；
- 哪一个虽然在运行，却可能基于错误前提继续消耗时间；
- 多个通知之间谁更重要。

### 7.4 跨工具恢复上下文

同一产品内恢复会话已很常见，但跨工具恢复仍受限于各自的会话格式、权限和恢复接口。任务说明、关键决定、代码改动、测试结果、待确认问题和下一步如何在不同 Agent 之间连续传递，尚无通用做法。

### 7.5 项目、任务、会话、分支与 worktree 的身份映射

不同产品选择不同核心对象：

- Codex 和 Claude 更接近会话；
- GitHub 更接近仓库、Issue、分支和 Pull Request；
- Multica 更接近 Issue 与 Task；
- 看板平台更接近任务卡与工作区。

当一张任务卡产生多个会话、一个会话跨多个分支，或多个 Agent 同时处理同一 Issue 时，映射关系仍复杂。

### 7.6 本地隐私与跨设备便利之间的平衡

完全本地有利于代码和凭据留在机器上，但远程查看、手机审批和团队协作需要中继、服务器或云同步。不同产品采取不同边界，用户仍需理解哪些数据留在本机、哪些进入服务端。

### 7.7 正确性与完成质量

多数工作台能知道 Agent 是否停止、退出或提交变更，却不一定能知道结果是否正确。自动测试、diff 审查、Artifact、人工审批和 Pull Request 是常见缓解手段，但并没有一个跨项目通用的“业务完成”判断器。

### 7.8 产品成熟度与持续维护

当前市场同时存在：

- Research Preview 或 Preview；
- 实验性 Labs；
- 仅 macOS 或仅特定宿主；
- 需要从源码安装的移动端；
- 官方页面之间的平台描述不一致；
- 公司关闭后转社区维护。

选型时不能只看功能列表，还要单独核对安装平台、版本状态、维护主体、数据迁移和服务依赖。

## 8. 资料局限

本轮研究仍有以下限制：

1. 没有实际安装每一个产品，能力判断来自官方公开资料。
2. 没有可比的一手收入、留存、付费转化和个人/团队用户占比数据，因此不做市场份额或市场规模排序。
3. 开源仓库的 Star、下载量和 Release 频率没有被用作产品价值或商业成功的替代指标。
4. Dispatch 官网与文档的平台表述不一致，已在正文中保留该矛盾。
5. 部分产品的“跨 Agent”支持依赖适配器或外部 CLI，其实际稳定性可能随 CLI 更新而变化。
6. GitHub、VS Code、Claude Code、Codex 和 Antigravity 的功能更新频率高，本报告只是 2026-07-31 的资料截面。
7. “未发现公开能力”不能解释为产品一定没有该能力。

## 9. 主要一手资料索引

### 原生厂商

- [OpenAI Codex App](https://openai.com/index/introducing-the-codex-app/)
- [OpenAI Codex 移动端预览](https://openai.com/index/work-with-codex-from-anywhere/)
- [Claude Code Agent View 文档](https://code.claude.com/docs/en/agent-view)
- [VS Code Agents Window 文档](https://code.visualstudio.com/docs/agents/agents-window)
- [GitHub Copilot Agents 概念](https://docs.github.com/en/copilot/concepts/agents)
- [GitHub 第三方 Coding Agents](https://docs.github.com/en/copilot/concepts/agents/about-third-party-coding-agents)
- [Google Antigravity](https://developers.googleblog.com/en/build-with-google-antigravity-our-new-agentic-development-platform/)

### 跨 Agent 与开源工具

- [AgentPulse](https://github.com/jstuart0/agentpulse)
- [Code Agent Kanban](https://github.com/ShenJiahuan/claude-kanban)
- [CliDeck 文档](https://docs.clideck.dev/)
- [Kandev](https://github.com/kdlbs/kandev)
- [Vibe Kanban](https://github.com/BloopAI/vibe-kanban)
- [Vibe Kanban 公司关闭公告](https://www.vibekanban.com/blog/shutdown)

### 项目平台与 Agent IDE

- [Multica 文档](https://multica.ai/docs)
- [Dispatch 文档](https://dispatch.codes/docs)
- [Jaade](https://jaade.app/)
