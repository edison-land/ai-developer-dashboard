# README SEO/GEO 设计说明

> 状态：已确认
> 日期：2026-07-30

## 目标

重写根目录 `README.md`，让搜索引擎、生成式搜索和首次访问 GitHub 的开发者快速确认三件事：

1. AI Developer Dashboard 是什么；
2. 它解决什么开发工作流问题；
3. 如何在本机启动并验证。

## 目标读者与语言

- 首要读者：同时使用 Claude Code、OpenAI Codex 和 Git，并行维护多个本地项目的开发者。
- README 使用英文主文，覆盖全球开发者搜索。
- 标题后保留一段简短中文摘要，帮助中文用户快速判断项目用途。

## 产品定位

采用结果导向定位：

> AI Developer Dashboard is a local-first project triage and workflow dashboard that unifies Claude Code, Codex, and Git activity, helping developers prioritize projects, understand current status, and decide what to do next.

GitHub description 使用：

> Local-first AI developer dashboard for Claude Code, OpenAI Codex, and Git. Prioritize projects, track status, review activity, and decide what to do next.

## 搜索实体与主题

README 自然使用以下实体和主题，不建立关键词列表，也不重复堆叠：

- AI developer dashboard
- local-first developer tool
- Claude Code
- OpenAI Codex
- Git activity
- project triage
- project status
- developer workflow
- AI coding projects

## README 信息结构

1. 项目名称与一句话定义
2. 中文摘要
3. `What problem does it solve?`
4. `Key features`
5. `How it works`
6. `Privacy and AI usage`
7. `Quick start`
8. `Current status`
9. `FAQ`
10. 项目结构、验证命令和文档入口

FAQ 回答以下问题：

- What is AI Developer Dashboard?
- Does it upload source code?
- Which AI coding tools does it support?
- Can it run without an AI model?

## 内容边界

- 只描述当前已经实现的能力。
- 将 v0.9.1 标为计划，不把模型通用配置、拖动分类等需求写成现有功能。
- 明确网页 MVP 已完成，Electron 安装包尚未开始。
- 明确数据默认保存在本机。只有用户主动触发 AI 总结时，程序才会向配置的模型服务发送经过截断的项目上下文。
- 不增加 `LICENSE`、`CONTRIBUTING` 或 `CHANGELOG` 章节。
- 不加入项目当前没有的徽章、截图、演示链接或发布包链接。

## 写作规则

- 先给定义和用户结果，再介绍技术结构。
- 标题使用用户会搜索的问题和概念。
- 每段只回答一个问题，使用短段落、表格和可扫描列表。
- 使用具体功能和命令，不使用宣传口号。
- 保留准确的 Node.js、pnpm、启动、验证和故障排查信息。

## 验收标准

- GitHub description 不超过 350 个字符。
- README 首屏同时出现产品类别、Claude Code、OpenAI Codex、Git 和本地优先定位。
- 新用户无需阅读源代码即可找到前置条件、启动命令、数据边界和当前成熟度。
- README 中的命令与 `package.json` 保持一致。
- 所有相对链接有效。
- `git diff --check` 通过。
- 临时目录和截图不进入提交。

## 实施进度

> 状态：README 已完成并通过本地验收

### 已完成

- 根 README 已改为英文主文和中文摘要。
- 已加入产品问题、现有功能、工作方式、数据边界、快速启动、当前状态和 FAQ。
- 已区分现有能力、v0.9.1 计划和暂缓的 Electron 工作。
- GitHub description 已定稿，共 154 个字符。

### 验证结果

- README 本地链接检查通过。
- `git diff --check` 通过。
- 全仓类型检查通过。
- 自动测试共 141 项，全部通过。
- 前端生产构建通过。
- `pnpm verify:ui-redesign` 通过。

### 待办与下一步

- 提交 README 和本进度更新。
- 创建公开 GitHub 仓库 `DrErwin/ai-developer-dashboard`。
- 设置 GitHub description，推送 `main`，再核对远程提交。
