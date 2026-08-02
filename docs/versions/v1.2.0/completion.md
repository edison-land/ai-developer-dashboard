# v1.2.0 完成情况：首位外部测试者交付

> 状态：🟡 内部交付准备完成，等待首位外部测试者
> 设计批准日期：2026-08-01
> 内部准备完成日期：2026-08-01

## 当前结论

v1.2.0 的内部交付准备、真实 Windows 本机隔离验证、T3 两轴自审和总控独立审核已完成。当前没有首位不参与开发者的真实安装、启动、基本使用或反馈证据，因此本版本**不能标记为最终完成**。

## 实际完成

- 新增 [实施计划](implementation-plan.md)，明确 v1.2.0 交付里程碑与实际使用的 v1.1.0 安装包软件版本之间的区别。
- 新增 [首位测试者说明](tester-guide.md)，包含安装、启动、卸载、安装包识别、SHA-256 核对、已知限制、`%APPDATA%` 数据路径、迁移备份恢复、启动失败处理和 GitHub Issues 人工反馈模板。
- 交付物沿用现有 Windows x64 NSIS 安装包：`dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe`；没有修改页面、展示内容、交互行为或 `packages/core`、`packages/server`、`packages/ui` 业务逻辑。
- 反馈路径为人工提交 GitHub Issues；不自动上传日志、API Key、项目源代码或完整对话内容。

## 交付物核对

| 项目 | 结果 |
|---|---|
| 交付里程碑 | `v1.2.0`（首位外部测试者交付） |
| 安装包软件版本 | `1.1.0` |
| 文件名 | `AI-Developer-Dashboard-v1.1.0-setup-x64.exe` |
| 文件大小 | `100,930,950` 字节 |
| ProductVersion / FileVersion | `1.1.0 / 1.1.0` |
| SHA-256 | `7EBD4B2A76B8C79851889174447FBC0D71EC4AAC3E569FEE8CB4B416E9E802A8` |
| Windows 架构 | x64 |
| 交付来源 | [`dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe`](../../../dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe) |

## 真实 Windows 验证

验证主体是项目所有者本机，不是外部测试者。验证在 Windows 临时目录中使用隔离的安装根、用户数据目录、旧数据目录和 fixture 项目，避免改动正式 `~/.ai-dashboard` 数据。

环境：Windows 11 家庭版中文版，OS build `26200`，x64；Node.js `v24.15.0`；pnpm `10.33.0`。

执行命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-desktop-installer.ps1 `
  -UpgradeInstallerPath dist/v1.1.1-test/AI-Developer-Dashboard-v1.1.0-setup-x64.exe `
  -KeepArtifacts
```

结果：**PASS**。

- v1.0.0 portable 读取旧数据：通过，fixture 项目数 `16`。
- v1.1.0 首次安装、桌面快捷方式、开始菜单快捷方式和真实窗口启动：通过。
- 旧 CLI/portable 数据迁移和页面/API 可用：通过，首次启动 fixture 项目数 `16`。
- 覆盖升级：通过，升级包只用于内部路径验证，ProductVersion 为 `1.1.1`，不是外部交付物。
- 卸载后安装文件移除、个人数据库和迁移备份保留：通过。
- 从迁移备份恢复数据库并重新安装：通过。
- 真实启动端口：首次 `62284`，覆盖升级 `65174`，重装 `50597`；均为 `127.0.0.1` 临时端口。
- 验证结束没有残留 AI Developer Dashboard 进程或其本地监听端口。

`-KeepArtifacts` 保留的可审计证据目录为：

`C:\Users\57652\AppData\Local\Temp\ai-dashboard-installer-a9e4811eb099409b8cea50c83871858b`

其中包含 `desktop-startup.log`、迁移 `manifest.json`、源数据库副本和恢复数据库。日志记录了单实例锁、Electron ready、本地 server 地址、数据迁移/已有数据状态和窗口显示；没有记录 API Key。

## 验证记录

- `pnpm test`：通过，162 项（core 103、server 30、UI 18、desktop 11）。
- `pnpm typecheck`：通过，所有 workspace 类型检查通过。
- `python C:\Users\57652\.agents\skills\docs-by-version\scripts\validate_versioned_docs.py .`：通过，0 个错误、0 个警告。
- `git diff --check`：通过；仅有 Git 对现有文件换行符的提示，没有空白错误。
- 安装包文件属性和 SHA-256：通过，与本文件和测试者说明一致。
- 启动失败提示：通过现有 `apps/desktop/src/main.ts` 的“启动失败”错误弹窗和 `apps/desktop/src/lifecycle.test.ts` 的失败清理测试确认；本阶段没有改动该行为。
- `code-review` 两轴自审：v1.2.0 文档仍是工作区未跟踪文件，因此 `git diff HEAD` 没有提交差异；审查员随后按当前文件内容和版本规范复核，Standards 与 Spec 均为 **PASS**，无未解决内部阻断。
- 总控独立审核：复跑 `pnpm test`（162 项）、`pnpm typecheck`、版本文档结构检查和 `git diff --check` 均通过；重新核对安装包 SHA-256 与说明一致、审计证据目录存在，且没有残留桌面进程。结论为**内部交付通过，最终外部验收待完成**。

## 逐条对照 v1.2.0 requirements.md

| 要求 | 自审结论 | 证据/剩余事项 |
|---|---|---|
| 1. 首位外部测试者识别正确版本安装包 | **内部准备通过；外部验收待完成** | 文件名、ProductVersion、大小和 SHA-256 已锁定；需要首位测试者实际确认其拿到并核对。 |
| 2. 按说明完成安装和启动，无终端、浏览器或端口操作 | **内部通过；外部验收待完成** | 本机隔离安装流程通过，测试者说明已提供；需要真实测试者独立完成。 |
| 3. 显示与现有版本相同的页面和业务内容 | **通过** | 沿用 v1.1.0；现有 UI 资源哈希和 v1.1.0 真实页面验收通过，本次安装流程也验证了非空 UI。 |
| 4. 启动失败有可理解提示，并能反馈或恢复 | **内部通过；外部验收待完成** | 现有弹窗、单元回归、人工反馈模板和迁移备份恢复说明已具备；需要记录真实测试者是否理解和使用。 |
| 5. 干净 Windows 环境完成真实安装、启动和卸载 | **本机隔离验证通过；最终外部验收待完成** | 当前证据来自项目所有者 Windows 11 的临时隔离目录，不能写成外部测试者或独立干净电脑结果。 |
| 6. 记录测试结果、已知限制和后续问题 | **内部准备通过；外部反馈待补** | 已记录本机结果和已知限制；首位测试者的真实结果、问题和后续项尚未产生。 |

## 已知限制

- 当前只支持 Windows x64；没有大规模 Windows 兼容承诺。
- 安装包没有付费代码签名，Windows 可能显示未知发布者提示；必须以 SHA-256 核对结果为准。
- 不包含自动更新、公开发布、托盘、开机启动、后台常驻、云同步、多用户或自动上传日志。
- 默认迁移的是旧 CLI/v1.0 portable 的 `~/.ai-dashboard`；非默认数据目录仍需由总控提供明确路径，不能假设会全盘扫描。
- 本机隔离验证不等同于首位外部测试者验收。

## 剩余事项与下一步

1. 由用户/总控提供或授权首位不参与开发者及其真实 Windows 验收环境。
2. 将测试者实际安装包、启动、基本使用、卸载、反馈和问题记录补入本文件。
3. 由总控进行最终独立审核；只有真实外部证据存在且审核通过后，才把 v1.2.0 状态改为“已完成”。
