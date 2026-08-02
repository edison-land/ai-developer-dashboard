# v0.9.0 完成情况：UI 回归保护

> 状态：✅ 已完成
> 完成日期：2026-07-29

## 实际完成

- `packages/ui` 建立 Vitest + jsdom + React Testing Library 测试环境，固定 fixture，不调用真实模型或网络。
- 今日重点覆盖自动候选、人工置顶、当天移除和归档排除。
- 项目页覆盖搜索、来源 OR 筛选、时间筛选，以及列表/阶段视图的 localStorage 持久化。
- 项目管理覆盖详情打开/关闭、阶段覆盖、归档、归档查看和恢复；服务端已有对应接口回归。
- 列表视图归档支持多个项目并行操作，每个项目独立显示“归档中”，不会因第二次点击覆盖第一个项目的状态。
- 批量总结覆盖 `X/总数`、逐项事件更新、单项失败后继续和最终统计。
- 设置页覆盖未实现 provider 禁用和刷新时总结开关；API 层覆盖无效 JSON、字段不完整和未知事件等异常响应解析；刷新失败原因直接显示在页面。
- 根 README、`docs/README.md`、[故障排查](troubleshooting.md)和[发布检查表](release-checklist.md)形成当时网页/CLI 阶段的新用户启动、验证和排错入口；后续桌面版资料见 [桌面版使用、调试与交付指南](../../desktop-usage-and-delivery.md)。

## 验证记录

- core：99 项通过。
- server：27 项通过。
- UI：15 项通过。
- 全仓合计：141 项自动测试通过。
- `pnpm typecheck`：通过。
- `pnpm test`：通过。
- `pnpm build:ui`：通过。
- `pnpm verify:ui-redesign`：通过，统一入口已包含 UI 测试。
- `git diff --check`：通过。

## 未覆盖风险

- 测试使用固定 fixture，不在 CI 中调用真实模型；真实模型验证仍由 v0.8.0 smoke 和发布清单单独负责。
- 尚未建立云端 CI，也没有把 Electron 纳入本阶段。
- 发布前的人工视觉检查仍需在目标屏幕上按发布清单执行。
