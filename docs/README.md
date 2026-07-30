# AI Developer Dashboard 文档

AI Developer Dashboard 是一个本机项目工作台，把 Claude Code、Codex 和 Git 的项目状态汇总到同一处，帮助用户判断今天优先推进什么、项目处于什么阶段、下一步做什么。

## 当前进度

- **最新完成里程碑**：v0.9.0 · UI 回归保护
- **下一计划里程碑**：v0.9.1 · 交互效率与模型接口通用化
- **桌面产品化**：v1.0.0 · 暂缓
- **远期自动化方向**：v2.0.0 · 项目任务卡驱动对话执行，需求已记录、尚未排期
- **文档整理日期**：2026-07-29

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
| v0.9.0 | UI 回归保护 | ✅ 已完成 | [需求](versions/v0.9.0/requirements.md) | [完成情况](versions/v0.9.0/completion.md) | — |
| v0.9.1 | 交互效率与模型接口通用化 | 🟡 计划中 | [需求](versions/v0.9.1/requirements.md) | [完成情况](versions/v0.9.1/completion.md) | — |
| v1.0.0 | Electron 桌面产品化 | ⏸️ 暂缓 | [需求](versions/v1.0.0/requirements.md) | [完成情况](versions/v1.0.0/completion.md) | — |
| v2.0.0 | 项目任务卡驱动对话执行 | 💡 远期规划 | [需求](versions/v2.0.0/requirements.md) | [完成情况](versions/v2.0.0/completion.md) | — |

## 阅读方式

- 想知道某阶段原本要做什么：看该版本的 `requirements.md`。
- 想知道实际做了什么、怎么验证、还剩什么：看 `completion.md`。
- 想看复杂阶段的完整设计取舍：打开表格中的设计或实施计划。
- 后续版本只记录新增或改变的规则；基础产品和架构从 v0.1.0 开始阅读。

## 项目总体资料

- [故障排查](troubleshooting.md)：启动、数据源、数据库和模型失败时怎么处理。
- [发布检查表](release-checklist.md)：自动验证、真实模型验证和人工视觉检查。

## 维护规则

1. 一个版本只对应一个开发阶段。
2. 开始阶段时先更新该版本 `requirements.md` 和 `completion.md` 的状态。
3. 完成阶段时先填写实际结果、验证和遗留问题，再进入下一版本。
4. 计划中、远期规划、已完成、暂缓必须明确区分。
5. 版本目录内不创建 `README.md`。
