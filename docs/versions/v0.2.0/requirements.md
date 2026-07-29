# v0.2.0 需求：Codex 三源合并

> 阶段目标：在现有 Claude Code + Git 基础上加入 Codex，同时保持“一项目一张卡”。

## 功能需求

1. 只读打开 Codex 的 `state_5.sqlite`。
2. 从 `threads` 表提取项目路径、最近活动和首条用户消息。
3. 从 `config.toml` 补充尚无线程的种子项目。
4. Claude Code、Codex 和 Git 继续按 canonical path 合并。
5. 页面能显示项目包含哪些来源。

## 数据可靠性规则

- Codex 正在写数据库时，读取不能使用可能造成旧快照或 torn read 的 immutable 模式。
- 启动时用 `PRAGMA table_info` 探测真实表结构。
- 缺列或 schema 漂移时降级，不绑定某个 Codex CLI 版本。
- `D:/PolyU`、`D:/polyu`、反斜杠和 `\\?\` 前缀视为同一 Windows 路径。
- 真实 cwd 以数据库记录为准，不能从有损文件夹名反向解码。

## 安全边界

- 不读取 `auth.json`、`secrets/`、`.sandbox-secrets/`。
- 不打开体积很大的 `logs_2.sqlite`。
- Codex 数据库始终只读，不影响 Codex 正常写入。

## 验收标准

1. 真实 Codex 数据可以加入项目列表。
2. 三源同一路径只产生一张卡。
3. 中文和大小写不同的路径能合并。
4. Codex 运行时读取不出现 `SQLITE_BUSY`。
5. schema 缺列时给出降级结果而不是崩溃。

## 本版本不做

- 读取 Codex 对话全文；
- 读取 Codex 密钥；
- AI 生成项目摘要；
- 改动既有 UI 信息架构。
