# v0.8.0 完成情况：现有能力名实一致

> 状态：✅ 已完成
> 完成日期：2026-07-29

## 实际完成

- `synthOnRefresh` 已接入刷新流程：关闭时只做机械采集，开启后先保存机械结果，再逐个总结未归档项目。
- 刷新响应返回更新、缓存、失败数量和错误；AI 失败不会回滚新的机械状态。
- 服务端刷新加了串行锁，自动刷新不会重叠启动两轮；启动预热只读取机械项目，不自动消耗模型额度。
- 设置页、服务端和本地存储都限制当前活动 provider 为已实现的 `zhipu`；Anthropic/OpenAI 保留为禁用的未来选项。
- `scripts/smoke-synth.ts` 修复了从仓库根目录启动的 workspace 导入，使用临时数据库，严格拒绝超过 2500 token 的输入，并记录实际日期、provider、模型、项目数和 token 统计。
- 增加启动端口占用的可读提示，并补充项目总体故障排查与发布检查文档。

## 自动测试与构建

- core：99 项通过；server：27 项通过。
- UI 测试基础已在本阶段接入，具体回归覆盖和测试文件归入 v0.9.0。
- `pnpm typecheck`：通过。
- `pnpm build:ui`：通过。
- `pnpm verify:ui-redesign`：通过。

## 真实模型 smoke

执行日期：2026-07-29（本地时间）。

- provider：`zhipu`
- 实际模型：`glm-4-flash`
- 选择项目：3 / 34
- 项目：博士课题、btc-bear-market-dashboard、ai-developer-dashboard
- 首次总结、schema 校验和第二次缓存命中：通过
- 输入 token：2132；输出 token：206；失败：0
- 使用临时 smoke 数据库，正式 dashboard 缓存未被写入；输出未包含 API Key 或完整 transcript。

## 偏离与遗留

- 暂未正式接入 Anthropic/OpenAI，保持需求中“本版本不做”的范围。
- 本阶段完成的是可重复的真实接口 smoke；发布前仍应按 [v0.9.0 发布检查表](../v0.9.0/release-checklist.md) 做一次当前环境的人工浏览器检查。
