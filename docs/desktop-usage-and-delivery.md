# 桌面版使用、调试与交付指南

> 适用对象：项目所有者、开发者和首位外部测试者
>
> 当前已验证的安装包软件版本：`1.1.0`（Windows x64）
>
> 本文是长期操作指南；`v1.2.0` 是“首位外部测试者交付”的里程碑号，不是当前安装包的软件版本。

## 先选对使用方式

这个项目有两种正常入口，服务的对象不同：

| 你要做什么 | 用哪种方式 | 是否需要命令行 |
|---|---|---|
| 像普通使用者一样打开软件 | 安装 Windows 安装包 | 不需要 |
| 改代码、查看启动问题或验证修改 | 从项目源码启动桌面调试模式 | 需要 |
| 让别人测试安装体验 | 单独发送安装包和测试者说明 | 对方不需要 |
| 生成新的安装包 | 从项目源码构建 Windows 安装包 | 需要 |

桌面版会自行启动本地后端并打开自己的软件窗口。普通使用者不需要浏览器、CLI 或端口；这些内容只属于开发与诊断流程。

## 一、项目所有者：像普通软件一样使用

### 首次安装

1. 双击当前指定安装包：[`AI-Developer-Dashboard-v1.1.0-setup-x64.exe`](../dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe)。
2. 按安装向导完成每用户安装。
3. 从桌面快捷方式或开始菜单中的 **AI Developer Dashboard** 打开。

正常启动后会出现现有项目页面。关闭主窗口即完全退出；它不驻留在托盘，也不会开机自启。

### 日常数据与卸载

- 安装版数据默认在 `%APPDATA%\AI Developer Dashboard\data`，不在安装目录。
- 卸载默认只删除程序文件，保留个人数据；重新安装同一软件后可继续使用这些数据。
- 第一次安装若发现旧 CLI 或 v1.0 portable 的默认数据目录 `%USERPROFILE%\.ai-dashboard`，会复制并接续数据；旧目录不会删除，并会在安装版数据目录保留 `migration-backups` 和 `manifest.json`。
- 不要手动删除 `data` 或 `migration-backups`。如需恢复，请保留它们并按[测试者说明](versions/v1.2.0/tester-guide.md#数据恢复)联系维护者确认目标。

### 启动失败时

1. 截取“启动失败”弹窗并记下完整文字。
2. 确认没有另一个 AI Developer Dashboard 窗口正在运行，再重试一次。
3. 不要先删除数据；将 Windows 版本、操作步骤、失败时间和截图通过 [GitHub Issues](https://github.com/DrErwin/ai-developer-dashboard/issues) 提交。

反馈中不要发送 API Key、完整项目日志、源代码或完整对话内容。

## 二、项目所有者：从源码调试

### 准备条件

- Windows x64。
- Node.js `20` 或更高版本；已验证环境使用 Node.js `24.15.0`。
- pnpm `10.33.0`。
- 已取得本项目源码。

在项目根目录 `D:\ai-developer-dashboard` 执行一次依赖安装：

```powershell
pnpm install
```

### 启动桌面调试窗口

```powershell
pnpm desktop:start
```

此命令会先构建前端和桌面主进程，再直接打开 Electron 桌面窗口。它是当前的“重建后启动”流程，不是自动热更新：修改 UI、桌面启动代码或后端代码后，请结束窗口与命令，再重新执行该命令。

### 用隔离数据调试（推荐）

默认调试会使用当前 Windows 用户的桌面数据。为了不碰日常数据，调试前先指定一个独立目录：

```powershell
$env:AI_DASHBOARD_DATA_DIR = "$PWD\.local-data"
pnpm desktop:start
```

完成后关闭当前 PowerShell 窗口，或执行以下命令恢复默认行为：

```powershell
Remove-Item Env:AI_DASHBOARD_DATA_DIR
```

`.local-data` 是本机调试数据，不能当作正式备份，也不应发送给外部测试者。

### 需要启动日志时

```powershell
$env:AI_DASHBOARD_DESKTOP_DEBUG_LOG = "$env:TEMP\ai-dashboard-desktop.log"
pnpm desktop:start
Get-Content $env:AI_DASHBOARD_DESKTOP_DEBUG_LOG
```

日志用于判断桌面窗口、本地后端和数据迁移是否启动；提交问题前仍须移除敏感信息。

### 修改后先做的检查

```powershell
pnpm test
pnpm typecheck
```

这些检查通过只说明代码层面没有明显回归；要验证安装、快捷方式、卸载和数据连续性，仍要执行本指南第四部分的交付验证。

## 三、把软件发给别人测试

### 只发送这两项

1. `AI-Developer-Dashboard-v1.1.0-setup-x64.exe`
2. [首位测试者说明](versions/v1.2.0/tester-guide.md)

不要发送整个源码目录、`v1.0.0` portable 文件，或名称带 `v1.1.1-test` 的内部覆盖升级测试包。

当前指定安装包的身份信息：

| 项目 | 正确值 |
|---|---|
| 文件名 | `AI-Developer-Dashboard-v1.1.0-setup-x64.exe` |
| 架构 | Windows x64 |
| ProductVersion | `1.1.0` |
| 文件大小 | `100,930,950` 字节 |
| SHA-256 | `7EBD4B2A76B8C79851889174447FBC0D71EC4AAC3E569FEE8CB4B416E9E802A8` |

发送前，可在 PowerShell 中核对文件：

```powershell
Get-FileHash .\AI-Developer-Dashboard-v1.1.0-setup-x64.exe -Algorithm SHA256
```

对方不需要会使用命令行才能安装；哈希核对是防止拿错文件的额外步骤。

### 请测试者反馈什么

请对方记录：Windows 版本、是否按说明识别正确文件、是否能独立安装和从快捷方式启动、是否看到现有项目页面、是否能卸载，以及任何报错截图或文字。

这类真实结果必须补入 [v1.2.0 完成情况](versions/v1.2.0/completion.md)，才能把“内部准备完成”升级为“外部验收完成”。在那之前，它不是公开发布版本。

## 四、以后构建新的 Windows 安装包

### 1. 先确定要发布的软件版本

本项目的文档里程碑号与安装包软件版本不同。准备新的安装包时，先确认软件版本，例如从 `1.1.0` 升至下一个已批准的版本；不要把仅表示交付阶段的 `v1.2.0` 直接写进安装包版本。

版本号变更需要同步检查 `apps/desktop/package.json` 中的：

- 顶部 `version`；
- `build.artifactName` 中的文件版本；
- `build.directories.output` 中的输出目录版本。

三处必须一致，避免“文件名、内部版本、输出目录”各自不同。

### 2. 构建前检查

在项目根目录执行：

```powershell
pnpm install
pnpm test
pnpm typecheck
```

确认没有把无关文件、测试用数据或旧安装包误带入本次交付。

### 3. 构建安装包

```powershell
pnpm desktop:package
```

当前 `1.1.0` 的输出位置是：

```text
dist\v1.1.0\AI-Developer-Dashboard-v1.1.0-setup-x64.exe
```

构建命令只生成 Windows x64 的 NSIS 安装包，不会自动公开发布、上传文件、签名、推送代码或替用户发送给测试者。

### 4. 核对产物身份

以新版本的真实路径替换下面的示例路径：

```powershell
$installer = '.\dist\v1.1.0\AI-Developer-Dashboard-v1.1.0-setup-x64.exe'
Get-Item $installer | Select-Object Name, Length
(Get-Item $installer).VersionInfo | Select-Object ProductVersion, FileVersion
Get-FileHash $installer -Algorithm SHA256
```

把最终文件名、大小、ProductVersion、FileVersion 和 SHA-256 写入对应版本的 `completion.md` 与测试者说明，再发送给别人。

### 5. 做真实安装验证

构建成功不代表安装体验通过。安装版至少应验证：安装、桌面和开始菜单快捷方式、正常启动、关闭后退出、数据迁移、升级、卸载保留数据、恢复和重新安装。

当前已有内部验证脚本，需要提供一个**版本号不同于正式安装包**的升级测试安装包路径：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-desktop-installer.ps1 `
  -UpgradeInstallerPath .\dist\v1.1.1-test\AI-Developer-Dashboard-v1.1.0-setup-x64.exe `
  -KeepArtifacts
```

`v1.1.1-test` 只用于验证覆盖升级，绝不能发送给外部使用者。验证脚本会在 Windows 临时目录使用隔离数据；保留的证据目录只用于内部审计。

### 6. 再交付给测试者

完成内部验证后，更新对应版本的 `completion.md`，再把新的安装包和匹配版本的测试者说明单独发送给测试者。收到真实非开发者的安装、使用、卸载和反馈证据后，才可以更新该版本的最终验收状态。

## 快速排查表

| 情况 | 先做什么 |
|---|---|
| 只是想使用软件 | 安装 `.exe`，从桌面或开始菜单打开。 |
| 想改代码或看日志 | 用 `pnpm desktop:start` 启动源码调试模式。 |
| 不想影响日常数据 | 先设置 `AI_DASHBOARD_DATA_DIR` 到 `.local-data`。 |
| 想生成可发给他人的文件 | 完成检查后运行 `pnpm desktop:package`。 |
| 别人拿到安装包打不开 | 核对 SHA-256，保留弹窗截图和数据目录，不要先删除数据。 |
| 想确认安装包真的可用 | 除自动检查外，执行真实 Windows 安装验证并收集外部测试者反馈。 |
