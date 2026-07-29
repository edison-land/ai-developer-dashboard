# 聚焦式界面重设计实施计划

> 里程碑：v0.6.0。本计划已由提交 `d46a968` 完成实施，统一验收入口为 `pnpm verify:ui-redesign`。版本入口见 [`docs/README.md`](../../README.md)。

- 设计依据：本目录的 [`design.md`](design.md)
- 目标：把默认页面改造成“今日三个重点”，并交付暖白/深墨双主题、紧凑项目页和右侧详情面板
- 实施方式：先建立可测试的推荐与偏好能力，再重组界面，最后做真实数据视觉验收

## 0. 当前基线与保护规则

### 已验证基线

- `pnpm test`：通过，核心 80 项、服务端 18 项，共 98 项。
- `pnpm build:ui`：通过。
- `pnpm typecheck`：当前已有 4 个错误，位于：
  - `packages/core/src/adapters/git.ts` 两处字符串解码类型错误；
  - `packages/core/src/store.ts` 一处 `DatabaseSync` 类型错误；
  - `packages/core/src/store.ts` 一处设置字段名错误。

这四个错误先作为“验证入口恢复”处理，只改类型表达与字段映射，不改变运行行为。

### 工作区保护

以下改动在本计划开始前已经存在，视为用户成果：

- `packages/core/src/domain.ts`
- `packages/ui/src/components/KanbanCardCompact.tsx`
- `packages/ui/src/components/ProjectCard.tsx`
- `packages/ui/src/views/ActivityView.tsx`

它们的共同意图是用紧凑来源图标减少文字噪声。实施时保留该意图，并把颜色改为双主题下都成立的语义颜色；不得用还原、重置或覆盖整文件的方式丢失这些改动。

以下未跟踪内容不纳入代码修改或提交：

- `.playwright-mcp/`
- `.superpowers/`
- `current-triage.png`

由于现有工作区包含用户未提交改动，功能实现完成后默认不自动创建代码提交；只提交本实施计划。

## 1. 恢复全仓类型检查基线

### 修改文件

- `packages/core/src/adapters/git.ts`
- `packages/core/src/store.ts`

### 实施步骤

1. 在 `git.ts` 明确使用字符串编码返回值，移除对字符串调用带编码参数的 `toString("utf8")`。
2. 在 `store.ts` 使用 `InstanceType<typeof DatabaseSync>` 表达数据库实例类型。
3. 将设置对象字段与数据库键做显式映射：
   - `autoRefreshMins` → `auto_refresh_mins`
   - `synthOnRefresh` → `synth_on_refresh`
4. 运行现有 Git、Store 测试，确认只修复类型、不改变行为。

### 验证

```powershell
pnpm --filter @ai-dashboard/core test -- src/adapters/git.test.ts src/store.test.ts
pnpm typecheck
```

通过标准：命令退出码均为 0，现有 98 项测试仍通过。

## 2. 建立重点推荐领域模型

### 新增文件

- `packages/core/src/focus.ts`
- `packages/core/src/focus.test.ts`

### 修改文件

- `packages/core/src/domain.ts`
- `packages/core/src/index.ts`

### 领域类型

新增：

```ts
type AttentionKind = "user-action" | "waiting" | "none" | "unknown";
type FocusReason = "pinned" | "running" | "needs-action" | "recent";

interface FocusPreferences {
  pinnedPaths: string[];
  dismissedPaths: string[];
  localDate: string;
}

interface FocusSelection {
  project: UnifiedProject;
  reason: FocusReason;
  pinned: boolean;
}
```

`SynthResult.attention` 设为可选字段，使旧缓存能够正常读取；缺失时按 `unknown`。

### 推荐纯函数

实现：

```ts
selectTodayFocus(
  projects: UnifiedProject[],
  preferences: FocusPreferences,
  nowMs: number,
): FocusSelection[]
```

规则：

1. 规范化路径时复用 `pathKey`。
2. 去除归档、完成、当天移除项目。
3. 先按 `pinnedPaths` 顺序放入有效置顶，最多三个。
4. 自动补位顺序为：
   - `liveStatus === "busy"`；
   - `attention === "user-action"`；
   - 阶段为 `building`/`verifying` 且近期活跃；
   - 其他最近活跃。
5. `attention === "waiting"` 不进入前两层，只能作为最后兜底。
6. 同层按 `lastActiveMs` 降序，再按 `canonicalPath` 排序。
7. 不重复项目；可选项目不足时返回少于三个。
8. 生成固定、可翻译的 `FocusReason`，不生成分数。

同时实现：

```ts
selectAttentionProjects(...)
```

用于首页下方最多五条“最近变化/需要关注”，并排除今日重点。

### 先写测试

覆盖设计文档中的十项推荐行为，并额外覆盖：

- 路径大小写与斜杠差异仍命中置顶；
- 重复置顶路径只保留一次；
- 超过三个置顶只取前三个；
- `waiting` 在存在其他候选时不占位置；
- 同输入多次调用顺序完全一致。

### 验证

```powershell
pnpm --filter @ai-dashboard/core test -- src/focus.test.ts
pnpm --filter @ai-dashboard/core typecheck
```

## 3. 升级总结结果的“需要处理/等待中”分类

### 修改文件

- `packages/core/src/synth/schema.ts`
- `packages/core/src/synth/bundle.ts`
- `packages/core/src/synth/synth.ts`
- `packages/core/src/synth/synth.test.ts`
- `packages/core/src/aggregate.ts`
- `packages/core/src/aggregate.test.ts`

### 实施步骤

1. `SynthSchema` 增加 `attention`：
   - `user-action`
   - `waiting`
   - `none`
   - `unknown`
2. 更新系统提示词，要求模型区分：
   - 用户现在可以处理的问题；
   - 只能等待外部条件的问题。
3. 增加 `SYNTH_SCHEMA_VERSION = 2`，把版本写入 `computeInputHash`。
4. `mergeByCanonicalPath` 与 `synthesize` 继续调用同一个 `computeInputHash`，确保旧缓存只会一次性标记为过期，不会永久过期。
5. 打开首页和普通刷新不调用 AI；只有用户原有的“生成/更新总结”动作才产生新请求。

### 测试

- 新格式能解析并持久化 `attention`；
- 老格式缺少字段时返回 `unknown`；
- `computeInputHash` 因版本升级与旧哈希不同；
- 新生成结果再次请求仍命中缓存；
- 提示词明确包含 `user-action` 与 `waiting` 的输出规则。

### 验证

```powershell
pnpm --filter @ai-dashboard/core test -- src/synth/synth.test.ts src/aggregate.test.ts
```

## 4. 保存重点偏好并提供本地接口

### 修改文件

- `packages/core/src/domain.ts`
- `packages/core/src/store.ts`
- `packages/core/src/store.test.ts`
- `packages/server/src/app.ts`
- `packages/server/src/app.test.ts`

### Store 能力

在 `Store` 中增加：

```ts
getFocusPreferences(localDate: string): FocusPreferences;
setFocusPreferences(preferences: FocusPreferences): void;
clearFocusPreference(canonicalPath: string): void;
```

在 SQLite 迁移中增加 `focus_preferences` 表，并准备读取、整体更新和单项目清除语句。

`setFocusPreferences` 必须：

1. 在事务中完成；
2. 校验置顶最多三个且唯一；
3. 先清除旧排名，再写入新排名；
4. 只保存当前日期的移除记录；
5. 使用 `pathKey` 保持路径大小写不敏感。

归档一个项目时，在同一次业务操作中清除它的重点偏好。

### API

新增：

- `GET /api/focus-preferences?localDate=YYYY-MM-DD`
- `PUT /api/focus-preferences`

`PUT` 校验：

- `localDate` 是真实的 `YYYY-MM-DD`；
- `pinnedPaths` 与 `dismissedPaths` 是字符串数组；
- `pinnedPaths` 最多三个、无重复；
- 同一路径不能同时置顶和当天移除。

非法输入返回 400 和可读错误；合法写入返回规范化后的偏好。

### 测试

- SQLite 关闭并重开后偏好仍存在；
- 置顶顺序不丢失；
- 第二天读取不返回昨日移除；
- API 拒绝无效日期、重复路径和超过三个置顶；
- 归档后偏好被清除；
- 恢复归档不恢复旧置顶。

### 验证

```powershell
pnpm --filter @ai-dashboard/core test -- src/store.test.ts
pnpm --filter @ai-dashboard/server test -- src/app.test.ts
```

## 5. 接入前端偏好数据

### 修改文件

- `packages/ui/src/api.ts`
- `packages/ui/src/hooks.ts`

### 实施步骤

1. 为偏好接口增加类型安全的 `getFocusPreferences` 与 `putFocusPreferences`。
2. 增加 `useFocusPreferences(localDate)`。
3. 增加带乐观更新的 `useSaveFocusPreferences()`：
   - 页面先立即反映置顶、移动和当天移除；
   - 保存失败时恢复上一次服务端状态；
   - 显示紧凑错误提示，不让整个首页报错。
4. 归档成功时同时刷新项目、活动、归档和重点偏好查询。

### 验证

```powershell
pnpm --filter @ai-dashboard/ui typecheck
pnpm --filter @ai-dashboard/ui build
```

## 6. 建立双主题与应用外壳

此任务开始正式使用用户指定的 `frontend-design` 技能：采用“暖白编辑台 / 深墨专注台”方向，避免通用紫色渐变、彩色玻璃卡片和无意义装饰。

### 新增文件

- `packages/ui/src/theme.ts`
- `packages/ui/src/components/ThemeToggle.tsx`
- `packages/ui/src/components/Icons.tsx`

### 修改文件

- `packages/ui/index.html`
- `packages/ui/src/index.css`
- `packages/ui/src/main.tsx`
- `packages/ui/src/App.tsx`

### 实施步骤

1. 在 `index.html` 的应用脚本之前读取：
   - `ai-dashboard:theme = system | light | dark`
   - Windows `prefers-color-scheme`
2. 立即设置根元素 `data-theme` 与 `color-scheme`，避免主题闪烁。
3. 在 `index.css` 定义设计文档中的语义变量：
   - 背景、普通表面、重点表面；
   - 主要/次要文字；
   - 边界；
   - 主要操作、注意、成功、失败。
4. 保留 Tailwind 做布局，但颜色改用语义类或 CSS 变量，不在组件中散落 `slate-*`、`sky-*`。
5. 使用轻量内联 SVG 图标，统一导航、刷新、主题、归档、来源与状态；移除导航 Emoji。
6. `App` 导航改为：
   - 今日；
   - 项目；
   - 动态；
   - 设置。
7. 头部只保留更新时间、刷新和主题切换。
8. 主题按钮在暖白/深墨之间直接切换；设置页稍后提供“跟随 Windows”。

### 验证

- 刷新页面时不闪出错误主题；
- 手动主题选择刷新后仍保留；
- 两套主题下根页面、头部与导航文字清晰；
- `prefers-reduced-motion` 继续生效。

```powershell
pnpm --filter @ai-dashboard/ui typecheck
pnpm build:ui
```

## 7. 实现“今日”页面

### 新增文件

- `packages/ui/src/views/TodayView.tsx`
- `packages/ui/src/components/TodayStatusStrip.tsx`
- `packages/ui/src/components/FocusCard.tsx`
- `packages/ui/src/components/FocusEditor.tsx`
- `packages/ui/src/components/CompactProjectRow.tsx`
- `packages/ui/src/components/TodaySkeleton.tsx`

### 修改文件

- `packages/ui/src/App.tsx`

### 实施步骤

1. `TodayView` 接收项目、重点偏好和打开详情回调。
2. 调用核心 `selectTodayFocus`，不在组件内复制推荐规则。
3. 状态摘要只显示正在运行、需要用户处理和本周活跃。
4. 三张 `FocusCard` 固定展示：
   - 编号与阶段；
   - 项目名称；
   - 当前情况；
   - 下一步；
   - 推荐原因与活跃时间。
5. 卡片不显示路径、来源、Git、模型、归档和阶段下拉框。
6. 点击卡片打开详情面板。
7. “调整重点”进入编辑状态，提供：
   - 置顶/取消；
   - 左移/右移；
   - 今天移除。
8. 自动位置当天移除后立即由下一候选补位。
9. 最近变化区最多五行，调用 `selectAttentionProjects`。
10. 首次加载显示三个同尺寸骨架；刷新时保留旧数据。

### 视觉通过标准

- 1366×768 首屏完整看到标题、状态和三张重点卡；
- 卡片中“当前情况”最醒目，“下一步”第二醒目；
- 一个卡片最多使用一种主要强调色；
- 没有总结时仍有可理解内容。

## 8. 实现项目列表、阶段视图与详情面板

### 新增文件

- `packages/ui/src/views/ProjectsView.tsx`
- `packages/ui/src/components/ProjectToolbar.tsx`
- `packages/ui/src/components/ProjectList.tsx`
- `packages/ui/src/components/ProjectListRow.tsx`
- `packages/ui/src/components/StageBoard.tsx`
- `packages/ui/src/components/StageCard.tsx`
- `packages/ui/src/components/ProjectDetailsDrawer.tsx`

### 修改文件

- `packages/ui/src/filter.ts`
- `packages/ui/src/hooks.ts`
- `packages/ui/src/App.tsx`
- `packages/ui/src/components/ProjectCard.tsx`
- `packages/ui/src/components/KanbanCardCompact.tsx`
- `packages/ui/src/components/FilterBar.tsx`
- `packages/ui/src/views/KanbanView.tsx`
- `packages/ui/src/views/TriageView.tsx`

### 实施步骤

1. `ProjectFilter` 增加搜索文字，并兼容旧 `localStorage` 数据。
2. `ProjectToolbar` 收敛为搜索、来源、活跃时间、列表/阶段和归档。
3. 默认列表行只显示名称、阶段、一句情况和活跃时间。
4. `StageBoard` 固定六个阶段：
   - 1440 及以上六列；
   - 1024–1439 三列两行；
   - 更窄单列或双列。
5. 删除 `KanbanView` 的 hover、遮罩、绝对定位浮层和完整卡复制。
6. `ProjectDetailsDrawer` 复用现有总结、阶段、Git、来源和归档能力。
7. 将 `ProjectCard` 中的业务操作迁移到详情内容，再删除不再使用的多用途卡片。
8. 保留现有未提交来源图标改造的“减少噪声”意图，但用统一 SVG 与主题变量表达，不保留紫/绿/蓝三种来源底色。
9. 关闭详情面板后保持原筛选、视图和滚动位置。

### 验证

- 所有原有操作仍可从详情面板完成；
- 阶段页不再发生悬停跳动；
- 1024 像素宽度没有整页横向溢出；
- 归档抽屉仍可恢复项目。

## 9. 收敛动态、设置、错误与归档视觉

### 修改文件

- `packages/ui/src/views/ActivityView.tsx`
- `packages/ui/src/views/SettingsView.tsx`
- `packages/ui/src/components/ErrorBanner.tsx`
- `packages/ui/src/components/ArchiveDrawer.tsx`
- `packages/ui/src/index.css`

### 实施步骤

1. 动态页改用同一套来源图标和单色时间线，不为每个来源分配大色块。
2. 设置页按“AI 总结 / 自动刷新 / 外观 / 本地数据”分组。
3. 外观区提供：
   - 跟随 Windows；
   - 暖白；
   - 深墨。
4. 错误条保留可操作信息，但减少整块红色面积；红色只标识失败标题和边界。
5. 归档抽屉使用项目列表行的同一视觉规则。
6. 清除仍然残留的彩色 Emoji、硬编码 Slate/Sky 色和 10 像素以下文字。

### 验证

逐页切换暖白与深墨，确认所有文字、表单、空态、错误和抽屉都可读。

## 10. 建立单一验收入口

### 新增文件

- `scripts/verify-ui-redesign.ps1`

### 修改文件

- `package.json`

### 脚本行为

根脚本新增：

```json
"verify:ui-redesign": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ui-redesign.ps1"
```

PowerShell 脚本按顺序执行：

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm build:ui`

任一步失败立即返回非零退出码。成功时打印三项清晰的 `PASS` 和最终 `UI REDESIGN ACCEPTANCE: PASS`。

### 验证

```powershell
pnpm verify:ui-redesign
```

通过标准：退出码 0，且输出最终 PASS 行。

## 11. 真实数据视觉验收

### 运行方式

1. 启动本地后端与网页。
2. 通过 `http://127.0.0.1` 打开可见页面，不使用 `file://`。
3. 使用当前真实 29 个项目数据检查。

### 截图清单

保存到 `.superpowers/evidence/ui-redesign/`：

- `today-light-1366x768.png`
- `today-dark-1366x768.png`
- `projects-list-light-1366x768.png`
- `projects-list-dark-1366x768.png`
- `stage-light-1440x900.png`
- `stage-dark-1440x900.png`
- `details-light-1366x768.png`
- `details-dark-1366x768.png`
- `today-light-1024x768.png`
- `stage-dark-1024x768.png`

### 人工检查表

- 三个重点在 1366×768 首屏完整可见；
- 第一眼先看到项目当前情况，再看到下一步；
- 首页没有完整路径、Git 详情和操作按钮噪声；
- 两套主题没有低对比文字；
- 1024 宽度无整页横向溢出；
- 阶段视图没有悬停放大；
- 详情面板打开/关闭后不丢筛选和滚动位置；
- 置顶、自动补位、当天移除与归档行为符合设计；
- 浏览器控制台无错误。

## 12. 最终交付报告

报告必须包含：

- 实际修改文件；
- `pnpm verify:ui-redesign` 的结果与测试数量；
- 十张视觉证据的路径；
- 暖白/深墨主题切换结果；
- 当前工作区中哪些改动是实施前已存在的；
- 仍未解决的问题，不用“已完成”掩盖。

只有自动验收通过、真实页面完成明暗主题视觉检查后，才能宣布重设计完成。
