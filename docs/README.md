# AI Developer Dashboard 文档

AI Developer Dashboard 是一个本机项目工作台，把 Claude Code、Codex 和 Git 的项目状态汇总到同一处，帮助用户判断今天优先推进什么、项目处于什么阶段、下一步做什么。

## 当前进度

- **最新完成里程碑**：v1.1.0 · 安装与数据管理
- **当前计划里程碑**：v1.2.0 · 首位外部测试者交付（内部准备完成，等待首位外部测试者）
- **桌面产品化**：v1.0.0 → v1.1.0 → v1.2.0 · 三阶段高层设计已批准
- **远期自动化方向**：v2.0.0 · 项目任务卡驱动对话执行，需求已记录、尚未排期
- **文档整理日期**：2026-08-02

这里的版本号是**需求里程碑号**，用于分开各阶段的需求和完成情况，不等同于 `package.json` 的软件版本，也不代表已经发布安装包。

## 版本列表

| 版本 | 阶段 | 状态 | 需求 | 完成情况 | 详细资料 |
|---|---|---|---|---|---|
| v0.1.0 | 机械核心 | ✅ 已完成 | [需求](versions/v0.1.0/requirements.md) | [完成情况](versions/v0.1.0/completion.md) | — |
| v0.2.0 | Codex 三源合并 | ✅ 已完成 | [需求](versions/v0.2.0/requirements.md) | [完成情况](versions/v0.2.0/completion.md) | — |
| v0.3.0 | AI 总结与成本控制 | ✅ 已完成 | [需求](versions/v0.3.0/requirements.md) | [完成情况](versions/v0.3.0/completion.md) | — |
| v0.4.0 | 阶段管理 | ✅ 已完成 | [需求](versions/v0.4.0/requirements.md) | [完成情况](versions/v0.4.0/completion.md) | — |
| v0.5.0 | 日常工作流补齐 | ✅ 已完成 | [需求](versions/v0.5.0/requirements.md) | [完成情况](versions/v0.5.0/completion.md) | — |
| v0.6.0 | 聚焦式界面重设计 | ✅ 已完成 | [需求](versions/v0.6.0/requirements.md) | [完成情况](versions/v0.6.0/completion.md) | [设计](versions/v0.6.0/design.md) · [实施计划](versions/v0.6.0/implementation-plan.md) |
| v0.7.0 | 批量总结实时进度 | ✅ 已完成 | [需求](versions/v0.7.0/requirements.md) | [完成情况](versions/v0.7.0/completion.md) | [设计](versions/v0.7.0/design.md) |
| v0.7.1 | 重点信号与来源展示完善 | ✅ 已完成 | [需求](versions/v0.7.1/requirements.md) | [完成情况](versions/v0.7.1/completion.md) | — |
| v0.8.0 | 现有能力名实一致 | ✅ 已完成 | [需求](versions/v0.8.0/requirements.md) | [完成情况](versions/v0.8.0/completion.md) | — |
| v0.9.0 | UI 回归保护 | ✅ 已完成 | [需求](versions/v0.9.0/requirements.md) | [完成情况](versions/v0.9.0/completion.md) | [故障排查](versions/v0.9.0/troubleshooting.md) · [发布检查表](versions/v0.9.0/release-checklist.md) |
| v0.9.1 | 交互效率与模型接口通用化 | ✅ 已完成 | [需求](versions/v0.9.1/requirements.md) | [完成情况](versions/v0.9.1/completion.md) | — |
| v1.0.0 | 桌面入口迁移 | ✅ 已完成 | [需求](versions/v1.0.0/requirements.md) | [完成情况](versions/v1.0.0/completion.md) | [总体设计](desktop-productization.md) · [实施计划](versions/v1.0.0/implementation-plan.md) |
| v1.1.0 | 安装与数据管理 | ✅ 已完成 | [需求](versions/v1.1.0/requirements.md) | [完成情况](versions/v1.1.0/completion.md) | [总体设计](desktop-productization.md) · [实施计划](versions/v1.1.0/implementation-plan.md) |
| v1.2.0 | 首位外部测试者交付 | 🟡 内部准备完成，等待外部验收 | [需求](versions/v1.2.0/requirements.md) | [完成情况](versions/v1.2.0/completion.md) | [总体设计](desktop-productization.md) · [实施计划](versions/v1.2.0/implementation-plan.md) · [测试者说明](versions/v1.2.0/tester-guide.md) |
| v2.0.0 | 项目任务卡驱动对话执行 | 💡 远期规划 | [需求](versions/v2.0.0/requirements.md) | [完成情况](versions/v2.0.0/completion.md) | — |

## 阅读方式

- 想知道某阶段原本要做什么：看该版本的 `requirements.md`。
- 想知道实际做了什么、怎么验证、还剩什么：看 `completion.md`。
- 想看复杂阶段的完整设计取舍：打开表格中的设计或实施计划。
- 后续版本只记录新增或改变的规则；基础产品和架构从 v0.1.0 开始阅读。

## 项目总体资料

- [桌面产品化设计](desktop-productization.md)：v1.0.0 至 v1.2.0 的薄壳渐进式拆分、共同边界和阶段关系。
- [桌面版使用、调试与交付指南](desktop-usage-and-delivery.md)：项目所有者如何日常使用和源码调试、管理本机 API Key 的显示、交给测试者，以及以后如何构建和验证新的 Windows 安装包。
- [AI 编程多会话管理与 Agent 工作台市场研究](market-research.md)：市场分类、主要产品事实、能力矩阵、趋势和仍未统一解决的问题；暂不包含本项目的最终定位与路线判断。

## 维护规则

1. 一个版本只对应一个开发阶段。
2. 开始阶段时先更新该版本 `requirements.md` 和 `completion.md` 的状态。
3. 完成阶段时先填写实际结果、验证和遗留问题，再进入下一版本。
4. 计划中、远期规划、已完成、暂缓必须明确区分。
5. 版本目录内不创建 `README.md`。
