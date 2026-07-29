# v0.1.0 完成情况：机械核心

> 状态：✅ 已完成
> 完成日期：2026-07-27
> 主要提交：`794da17`

## 实际完成

- 建立 `core / server / ui / cli` 四层 pnpm monorepo。
- 完成 Claude Code 和 Git 适配器。
- 完成 Windows 路径规范化、项目聚合和活跃度分桶。
- 使用 Node 内置 `node:sqlite` 保存设置和阶段覆盖。
- 完成 Hono API、React 基础界面和 CLI 启动入口。
- 加入结构化接口错误、真实错误原因和页面重试。

## 验证记录

初始阶段在本机真实数据上验证：

- 读取 13 个 Claude Code 项目；
- 覆盖 4 个中文路径；
- 7 个非 Git 目录能够优雅降级；
- Git 快照与 busy/idle 状态正常合并。

当前代码仍保留对应的路径、Claude Code、Git、聚合、存储、服务端和 Dashboard 集成测试。

## 与原设想的偏离

- 原设想使用 `better-sqlite3`，本机 Node 24 原生编译不稳定。
- 实际改用 Node 24 内置 `node:sqlite`，减少安装失败和二进制兼容问题。

## 遗留到后续版本

- Codex 数据源进入 v0.2.0。
- AI 总结进入 v0.3.0。
- 阶段管理进一步收敛进入 v0.4.0。
- 活动、筛选和归档进入 v0.5.0。
