# v1.1.0 完成情况：安装与数据管理

> 状态：✅ 已完成并通过总控独立审核
> 设计批准日期：2026-08-01
> 完成日期：2026-08-01

## 实际完成

- `apps/desktop` 从 v1.0.0 portable 目标扩展为 Windows x64 NSIS 安装包，保持原 `appId` `com.aideveloperdashboard.desktop`，创建桌面和开始菜单快捷方式，并使用每用户安装模式。
- 安装版默认把个人数据库放在 Electron 用户数据目录下的 `data` 子目录，不放进安装目录；卸载配置显式保留应用数据。
- 首次启动安装版时，如果新目录没有数据库而旧 CLI/v1.0 portable 的默认 `~/.ai-dashboard` 存在，桌面层会自动复制旧目录。旧目录不删除；新目录同时保留时间戳迁移备份和 `manifest.json`。
- 迁移使用 staging 目录，迁移失败不会删除源数据或已有的恢复临时目录；`AI_DASHBOARD_DATA_DIR` 仍作为 CLI、开发和诊断的显式兼容路径。
- 覆盖升级和重装继续使用同一安装标识；页面仍加载原 `packages/ui/dist`，没有改变 `packages/core`、`packages/server` 或 `packages/ui` 的业务逻辑。
- 新增数据迁移单元测试、旧 portable 数据探测、数据库连续性检查和 Windows 安装流程验证脚本。

## 交付物

- Windows x64 安装包：[AI-Developer-Dashboard-v1.1.0-setup-x64.exe](../../../dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe)
  - 文件大小：100,930,950 字节
  - SHA-256：`7EBD4B2A76B8C79851889174447FBC0D71EC4AAC3E569FEE8CB4B416E9E802A8`
  - ProductVersion：`1.1.0`
  - 构建命令：`pnpm desktop:package`
- 仅用于证明覆盖升级路径的测试包：`dist/v1.1.1-test/AI-Developer-Dashboard-v1.1.0-setup-x64.exe`，通过 `--config.extraMetadata.version=1.1.1` 生成，不是 v1.1.0 对外交付物。
- 真实验证脚本：`scripts/verify-desktop-installer.ps1`。它要求显式提供不同版本的 `-UpgradeInstallerPath`，避免把同版本重复安装误报为升级。
- 产物位于被 Git 忽略的 `dist/`；本阶段没有提交、推送或发布 Git 变更。

## 验收结果

1. **首次安装和常用入口：通过。** v1.1.0 NSIS 安装器在 Windows 11 x64 上完成每用户安装，真实创建桌面和开始菜单快捷方式，并从安装后的 `AI Developer Dashboard.exe` 启动。
2. **页面和业务内容：通过。** 安装包内 UI 的 3 个文件与 `packages/ui/dist` 逐文件 SHA-256 一致；安装版真实窗口加载非空页面；core/server/ui 原有测试均通过。
3. **旧 CLI 和 v1.0 portable 数据：通过。** 验证脚本先用现有 v1.0.0 portable `.exe` 读取同一份旧数据 fixture（16 个项目），再安装 v1.1.0；首次启动使用自动迁移后的安装版目录并保留旧目录。
4. **覆盖升级：通过。** 使用相同 `appId` 的 v1.1.1 测试安装器真实覆盖 v1.1.0；升级后项目阶段、归档、今日重点、AI 总结缓存和模型配置均保持不变。
5. **卸载和重装：通过。** 关闭软件后执行 NSIS 静默卸载；安装程序文件被移除，个人数据库和迁移备份仍存在；重新安装 v1.1.0 后再次读取相同数据。
6. **迁移备份和恢复：通过。** 迁移目录包含源数据副本和 `manifest.json`；验证脚本把备份复制到独立恢复目录后重新读取阶段、归档、焦点、总结缓存和模型配置，恢复检查通过。

## 验证记录

- `pnpm test`：通过，162 项（core 103、server 30、UI 18、desktop 11）。
- `pnpm typecheck`：通过，所有 workspace 类型检查通过。
- `pnpm --filter @ai-dashboard/desktop test`：通过，desktop 11 项，其中数据迁移 5 项、生命周期 6 项。
- `pnpm desktop:package`：通过，生成 v1.1.0 Windows x64 NSIS 安装包。
- `pnpm --filter @ai-dashboard/desktop exec electron-builder --win nsis --x64 --publish never --config.extraMetadata.version=1.1.1 --config.directories.output=../../dist/v1.1.1-test`：通过，生成覆盖升级测试包。
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-desktop-installer.ps1 -UpgradeInstallerPath dist/v1.1.1-test/AI-Developer-Dashboard-v1.1.0-setup-x64.exe`：通过，覆盖 v1.0 portable 读取、首次安装、迁移、快捷方式、真实覆盖升级、卸载保留、备份恢复和重装恢复。
- UI 资源逐文件哈希核对：通过，3/3 一致。
- `git diff --check`：通过。
- `code-review` 复审：Standards **PASS**；Spec **PASS**。首轮发现的 staging 临时目录清理风险和同版本伪升级路径已修复并重测。
- 总控独立审核：Standards 与 Spec 两轴均通过；总控在不新建非 Luna 审查线程的约束下完成只读复核，并独立重跑全仓测试、类型检查、文档检查和真实 Windows 安装流程。

## 验证环境

- Windows 11 家庭版中文版，OS build `26200`
- Node.js `v24.15.0`
- pnpm `10.33.0`
- Electron `43.2.0`
- electron-builder `26.15.3`

## 与计划的差异

- 计划中的“安装版数据目录”实际落在 Electron 用户数据目录下的 `data` 子目录；旧默认目录仍保留为迁移源和人工恢复依据。
- 为证明真实覆盖升级，额外生成了一个版本号为 1.1.1 的本地测试包；它只用于验收，不改变 v1.1.0 交付物和路线。
- 迁移备份采用可直接复制的目录副本和清单，没有增加新的页面恢复功能；恢复验证属于安装/诊断流程，不改变业务界面。

## 已知限制

- 当前只交付 Windows x64 安装包，并只在项目所有者的 Windows 11 环境完成真实验收；干净电脑和外部测试者交付属于 v1.2.0。
- 默认自动接续的是旧 CLI/v1.0 portable 的 `~/.ai-dashboard` 数据目录；非默认 CLI `--data-dir` 仍需通过现有显式数据目录覆盖提供路径，没有做全盘扫描。
- 迁移后安装版使用新的个人数据副本，旧 CLI/portable 源目录保留但不与安装版做双向同步；普通使用应转到安装版，旧入口仅作为内部诊断工具。
- 未加入自动更新、云同步、多用户、自动上传日志、正式公开发布或付费代码签名要求。

## 下一步

v1.1.0 已完成并通过总控独立审核，满足 v1.2.0 启动条件。下一步派发 T3，只处理首位外部测试者交付，不改页面和业务逻辑。
