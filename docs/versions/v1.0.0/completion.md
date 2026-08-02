# v1.0.0 完成情况：桌面入口迁移

> 状态：✅ 已完成并通过审核
> 设计批准日期：2026-08-01
> 完成日期：2026-08-01

## 实际完成

- 新增 `apps/desktop` Electron 薄壳，继续直接复用 `packages/core`、`packages/server` 与 `packages/ui`，未修改现有页面、展示内容或业务流程。
- 桌面软件在同一主进程内启动现有本地 server，只监听 `127.0.0.1`，由 Windows 自动分配空闲端口；普通用户不需要接触 CLI、浏览器地址或端口。
- Electron 窗口继续加载原有 UI 构建产物，并在 React 根节点实际渲染后才显示。渲染进程启用上下文隔离和沙箱，不开放 Node.js 能力，也不允许打开外部窗口或跳转到其他来源。
- 使用 Electron 单实例锁；第二次双击会触发现有窗口恢复、显示和聚焦，不会启动第二套后端。
- 关闭最后一个窗口时先关闭本版本启动的 server 和 SQLite，再完全退出；即使清理步骤报错也会记录错误并保证退出。
- 默认继续使用 `~/.ai-dashboard`，不复制、不迁移数据库；Claude Code 与 Codex 的既有来源路径也继续由原 `resolveConfig()` 解析。
- `apps/cli` 保留为内部开发、测试和诊断入口，普通用户交付物不再依赖它。

## 交付物

- Windows x64 免安装测试版：`dist/v1.0.0/AI-Developer-Dashboard-v1.0.0-portable-x64.exe`
- 文件大小：90,664,669 字节。
- SHA-256：`7C61112042EA76F228D23C0C319EB1FC2333D4C3639AC5492D258F2B95427F40`
- 构建命令：`pnpm desktop:package`
- Windows 验证命令：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-desktop-portable.ps1 -VerifyExistingData`

该产物位于被 Git 忽略的 `dist/`，本阶段没有提交、推送或发布 Git 变更。

## 验收结果

1. **双击免安装版：通过。** portable `.exe` 在 Windows 真实启动并出现 `AI Developer Dashboard` 独立窗口。
2. **无需终端、浏览器和端口配置：通过。** 软件自行取得随机回环端口并在 Electron 窗口中加载页面。
3. **页面和主要交互一致：通过。** 打包内 3 个 UI 文件与 `packages/ui/dist` 的 SHA-256 逐文件一致；窗口在非空 React 根节点出现后才显示，原 UI 的 18 项自动化测试全部通过。
4. **现有数据与配置连续：通过。** 使用默认 `C:\Users\57652\.ai-dashboard` 真实启动，直接读取 37 个既有项目、既有 `zhipu` provider 和已配置密钥状态，无需复制数据库或重新设置。
5. **单实例与窗口唤醒：通过。** 真实验收先最小化窗口，再第二次启动 portable；原窗口被恢复，最终只有 1 个桌面主进程和 1 个后端监听。
6. **关窗完全退出并可重启：通过。** 正常关闭窗口后主进程消失、原端口释放；再次启动得到新的主进程和新的随机端口。
7. **网页和核心回归：通过。** `packages/core`、`packages/server`、`packages/ui`、`apps/desktop` 共 157 项测试全部通过，所有 workspace 类型检查通过。

## 验证记录

- `pnpm test`：通过，共 157 项（core 103、server 30、UI 18、desktop 6）。
- `pnpm typecheck`：通过。
- `pnpm desktop:package`：通过，生成 Windows x64 portable 产物。
- `scripts/verify-desktop-portable.ps1 -VerifyExistingData`：通过，覆盖首次启动、非空 UI、真实窗口恢复、单实例、单后端、正常关窗、端口释放、重启和默认旧数据读取。
- 打包 UI 与源 UI 逐文件哈希核对：3/3 一致，无差异。
- `git diff --check`：通过。
- 两轴严格审核：首轮不通过后补齐 failure-safe 退出、共享 server 启动逻辑和真实验收证据；复审 Standards 与 Spec 均为 **PASS**。
- `pnpm audit --prod --audit-level high`：通过；完整生产依赖审计仍报告 1 个 moderate 的 `@hono/node-server` `serve-static` 公告。本项目没有使用该静态中间件，使用自有静态处理器且只监听本机回环地址，因此不构成本阶段阻断。

## 与原计划的差异

- 高层计划只规定“薄桌面外壳”，实施时选用 Electron 43.2.0 与 electron-builder 26.15.3 的 portable 目标。
- Electron 的 ESM 主入口在打包实测中未执行，已改为 CommonJS bundle；源 TypeScript 和三层业务包边界不变。
- 真实 portable 每次启动需要先解压运行时，当前机器首次出现窗口约需数秒；安装后的启动体验属于 v1.1.0。

## 已知限制

- 当前只交付 Windows x64 免安装测试版，不包含安装、覆盖升级、卸载、开始菜单或桌面快捷方式。
- portable 文件未使用付费代码签名，Windows 可能显示未知发布者提示；代码签名不是 v1.0.0 或 v1.1.0 的完成条件。
- 当前产物只在本项目所有者的 Windows 环境完成真实验收；干净电脑与外部测试者交付属于 v1.2.0。
- 不包含托盘、后台常驻、开机启动、自动更新、云同步、多用户或自动上传日志。

## 下一步

v1.0.0 已满足 v1.1.0 的启动条件。下一阶段只处理安装、升级、卸载和数据保留，不修改页面与业务逻辑。
