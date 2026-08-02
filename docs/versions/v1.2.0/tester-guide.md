# AI Developer Dashboard v1.2.0 首位测试者说明

## 先确认你拿到的是正确文件

这里的 **v1.2.0** 是“首位外部测试者交付”的里程碑号；安装包本身沿用已经验证过的 **软件版本 1.1.0**。

唯一指定的 Windows x64 安装包是：

- 文件名：`AI-Developer-Dashboard-v1.1.0-setup-x64.exe`
- 文件大小：`100,930,950` 字节
- ProductVersion：`1.1.0`
- SHA-256：`7EBD4B2A76B8C79851889174447FBC0D71EC4AAC3E569FEE8CB4B416E9E802A8`
- 交付方式：由总控把这个 `.exe` 文件和本说明一起单独传给测试者；下面的项目内路径只用于内部审计，不要求测试者访问仓库。
- 内部审计来源：[`dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe`](../../../dist/v1.1.0/AI-Developer-Dashboard-v1.1.0-setup-x64.exe)

在 Windows PowerShell 中核对文件完整性：

```powershell
Get-FileHash .\AI-Developer-Dashboard-v1.1.0-setup-x64.exe -Algorithm SHA256
```

也可以在命令提示符中运行：

```cmd
certutil -hashfile AI-Developer-Dashboard-v1.1.0-setup-x64.exe SHA256
```

只有输出的 SHA-256 与上面的值完全一致时才继续。不要使用 v1.0.0 portable 文件，也不要使用名称带 `v1.1.1-test` 的覆盖升级测试包。

## 安装、启动和卸载

1. 双击安装包，按安装器提示完成安装。默认使用每用户安装，不需要打开终端、浏览器或手动设置端口。
2. 安装完成后，从桌面快捷方式或开始菜单中的 **AI Developer Dashboard** 启动。
3. 软件窗口出现后，确认可以看到现有项目页面；正常使用不需要运行命令行窗口。
4. 如需卸载，可在 Windows“设置 → 应用 → 已安装的应用”中找到 **AI Developer Dashboard** 并卸载，也可以运行开始菜单中的卸载入口。

## 数据会保留在哪里

- 安装版个人数据不放在安装目录中，默认位于 `%APPDATA%\AI Developer Dashboard\data`。在文件资源管理器的地址栏输入 `%APPDATA%`，即可进入当前 Windows 用户的应用数据目录。
- 默认卸载不会删除个人数据；重新安装同一软件后可以继续读取这些数据。
- 如果首次安装发现默认旧 CLI/v1.0 portable 数据目录 `%USERPROFILE%\.ai-dashboard`（也写作 `~/.ai-dashboard`）中有数据，安装版会自动接续它；旧目录不会被删除，安装版还会在 `data\migration-backups\<时间戳>\source` 目录保存可恢复副本，并在同级保存 `manifest.json`。程序不会自动扫描其他位置的数据库。
- 本版本不做云同步、多用户和自动上传日志。数据仍在本机，测试者应像保护其他本地工作数据一样保护该目录。

## 启动失败时怎么办

程序遇到启动错误时应显示“启动失败”弹窗和具体原因，不应无声退出。

请按以下顺序处理：

1. 先记录弹窗全文并截图；不要删除数据库或迁移备份。
2. 关闭弹窗，确认没有另一个 **AI Developer Dashboard** 窗口仍在运行，再尝试启动一次。
3. 如果仍然失败，保留安装包文件，重新执行上面的 SHA-256 核对，并记录 Windows 版本、失败步骤和失败时间。
4. 通过项目的 [GitHub Issues](https://github.com/DrErwin/ai-developer-dashboard/issues) 提交信息。反馈中不要附 API Key、完整项目日志、源代码或完整对话内容。

反馈模板：

```text
交付里程碑：v1.2.0（安装包软件版本 1.1.0）
Windows 版本：
安装包 SHA-256：
操作步骤：
弹窗全文：
是否重试过：
截图/其他现象：
```

## 数据恢复

如果需要恢复首次迁移前的数据，先完全退出软件，并把当前 `data` 目录和 `migration-backups` 目录复制到另一个安全位置。恢复时使用对应备份目录中的 `source` 目录内的文件作为恢复副本；不要直接覆盖现有目录，先把备份路径和操作步骤提交到 GitHub Issues，由维护者确认恢复目标。

## 已知限制

- 当前只支持 Windows x64；没有做大规模 Windows 兼容承诺。
- 安装包没有付费代码签名，Windows 可能显示未知发布者提示；这不表示文件校验失败。仍必须先核对 SHA-256。
- 不包含自动更新、公开发布、托盘、开机启动、后台常驻、云同步、多用户或自动上传日志。
- 这是首位外部测试者交付，不是正式公开发布；测试者反馈可能导致后续修复或重新交付。
