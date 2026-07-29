# v0.2.0 完成情况：Codex 三源合并

> 状态：✅ 已完成
> 完成日期：2026-07-28
> 主要提交：`e645699`

## 实际完成

- 新增 Codex 适配器和独立测试。
- 通过只读 URI 打开 `state_5.sqlite`，不使用 immutable。
- 完成 `threads` schema 探测和缺列降级。
- 从 `config.toml` 读取种子项目。
- 复用 v0.1.0 已建立的路径合并层，UI 无需为第三来源重写。

## 验证记录

历史真实数据验证：

- 项目数量由 13 增加到 34；
- 产生 7 张 Claude Code + Codex + Git 融合卡；
- 中文路径成功合并；
- 未出现 `SQLITE_BUSY`。

当前 `packages/core/src/adapters/codex.test.ts` 保留 12 项 Codex 适配器测试，并有 Dashboard 三源集成测试。

## 关键发现

- Codex 的真实列结构与早期假设不同，schema 探测成为长期兼容策略。
- Windows 路径必须用不区分大小写的 `pathKey` 分组，但展示时保留代表路径的原始大小写。

## 遗留到后续版本

- 项目语义总结与成本控制进入 v0.3.0。
- Codex schema 后续变化继续采用“探测 + 降级”，不锁定 CLI 版本。
