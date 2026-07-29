# AI Developer Dashboard 版本化文档结构设计

- 日期：2026-07-29
- 状态：已获得目录方向确认，等待书面设计审阅
- 范围：仅重组 `README.md` 与 `docs/` 文档，不修改业务代码和软件版本号

## 1. 目标

把当前按“综合 PRD / 补充需求 / 当前进度 / 历史设计”组织的文档，改成按需求里程碑组织。

重构后应满足：

1. 一个版本只描述一个开发阶段；
2. 每个阶段同时能看到原始需求和实际完成情况；
3. `docs/README.md` 是唯一总入口；
4. 读者不需要在多份综合文档中判断哪份状态更新；
5. 文档版本号不改变 `package.json` 中的 `0.1.0`。

## 2. 最终目录

```text
docs/
  README.md
  versions/
    v0.1.0/
      requirements.md
      completion.md
    v0.2.0/
      requirements.md
      completion.md
    v0.3.0/
      requirements.md
      completion.md
    v0.4.0/
      requirements.md
      completion.md
    v0.5.0/
      requirements.md
      completion.md
    v0.6.0/
      requirements.md
      completion.md
      design.md
      implementation-plan.md
    v0.7.0/
      requirements.md
      completion.md
      design.md
    v0.7.1/
      requirements.md
      completion.md
    v0.8.0/
      requirements.md
      completion.md
    v0.9.0/
      requirements.md
      completion.md
    v1.0.0/
      requirements.md
      completion.md
```

版本目录内不使用 `README.md`。

## 3. 文件职责

### `docs/README.md`

只保留便于快速判断的信息：

- 产品解决什么问题；
- 文档版本号是需求里程碑号，不等同于软件发布版本；
- 当前已完成版本；
- 下一计划版本；
- 版本、阶段、状态、需求文件、完成情况文件的链接表；
- 简短的文档维护规则。

不在根文档重复完整需求、技术方案或测试明细。

### `requirements.md`

只记录该版本开始前确定的内容：

- 版本目标；
- 用户问题；
- 功能需求；
- 关键业务与技术规则；
- 验收标准；
- 明确不做的内容。

后续版本只写新增或改变的规则，不复制此前版本的全部规格。

### `completion.md`

只记录该版本结束后的事实：

- 当前状态；
- 实际完成内容；
- 对应代码模块或提交；
- 实际验证结果；
- 与原需求的偏离；
- 遗留问题及其归属版本。

计划版本也保留此文件，但必须明确写“未开始”或“计划中”，不能制造已经完成的印象。

### 附加文件

只有确实存在独立设计或详细实施计划时才保留：

- `design.md`：重要设计选择和被否决方案；
- `implementation-plan.md`：具体实施顺序和验收步骤。

不为简单版本创建空的附加文件。

## 4. 版本映射

| 版本 | 单一阶段 | 状态 | 主要依据 |
|---|---|---|---|
| v0.1.0 | 机械核心 | 已完成 | 初始提交、原 PRD 的 Phase 1 |
| v0.2.0 | Codex 三源合并 | 已完成 | Phase 2 提交与路径规则 |
| v0.3.0 | AI 总结与成本控制 | 已完成 | Phase 3 提交、模型与缓存规则 |
| v0.4.0 | 阶段管理 | 已完成 | 阶段视图、人工覆盖与来源规则 |
| v0.5.0 | 日常工作流补齐 | 已完成 | 活动、筛选、归档、自动机械刷新、R1–R4 |
| v0.6.0 | 聚焦式界面重设计 | 已完成 | 已确认设计、实施计划和验收入口 |
| v0.7.0 | 批量总结实时进度 | 已完成 | 逐项回传设计与实现提交 |
| v0.7.1 | 重点信号与来源展示完善 | 已完成 | 最新界面细节提交 |
| v0.8.0 | 现有能力名实一致 | 计划中 | 自动总结接线、模型范围、真实冒烟 |
| v0.9.0 | UI 回归保护 | 计划中 | 关键页面自动测试和发布检查 |
| v1.0.0 | Electron 桌面产品化 | 暂缓 | 用户决策后才启动 |

补充规则：

- v0.5.0 中记录 R4 悬停放大曾经完成；
- v0.6.0 中记录 R4 被紧凑阶段视图和详情弹窗主动替代；
- 被后续版本替代的功能不回写成早期版本“未完成”。

## 5. 现有文档迁移

| 现有文件 | 迁移结果 |
|---|---|
| `docs/spec.md` | 按 Phase 1–5 拆入 v0.1.0–v0.5.0；跨版本规则归入首次引入它的版本 |
| `docs/extra-requirements.md` | R1–R3 进入 v0.5.0；R4 的实现与替代分别记录在 v0.5.0、v0.6.0 |
| `docs/development-status.md` | 已完成阶段拆入各版本 `completion.md`；未来阶段拆入 v0.8.0、v0.9.0、v1.0.0 |
| 聚焦式重设计设计 | 移为 `v0.6.0/design.md` |
| 聚焦式重设计实施计划 | 移为 `v0.6.0/implementation-plan.md` |
| 批量总结进度设计 | 移为 `v0.7.0/design.md` |
| 本版本化文档结构设计 | 仅用于指导本次迁移；迁移完成后从工作树删除，Git 历史保留设计依据 |
| 仓库根 `README.md` | 保留启动、验证、代码结构；文档入口改为 `docs/README.md` |

迁移完成后删除：

- `docs/spec.md`；
- `docs/extra-requirements.md`；
- `docs/development-status.md`；
- 已经迁入版本目录的 `docs/superpowers/` 文档；
- 本次迁移使用的临时结构设计；
- 空的 `docs/superpowers/` 目录。

## 6. 内容处理规则

1. 不按原文件整段复制；先按“该规则首次属于哪个阶段”拆分。
2. 历史事实保留日期和提交号，未来计划不伪装成完成记录。
3. 早期需求与后期替代都保留，但分别放在各自版本。
4. 每个 `completion.md` 必须能够回答：
   - 做了什么；
   - 当前状态；
   - 如何验证；
   - 还剩什么。
5. 所有相对链接从新目录重新计算。
6. 不修改业务代码、测试代码、`package.json` 或 Git tag。

## 7. 验收标准

结构验收：

1. `docs/` 根目录只保留 `README.md` 和 `versions/`；
2. 每个版本目录都有 `requirements.md` 与 `completion.md`；
3. 版本目录内没有 `README.md`；
4. 一个版本文件中不混入另一个独立阶段的未来需求；
5. 旧综合文档和重复历史文件已经删除。

内容验收：

1. `docs/README.md` 的每个版本链接都能打开；
2. 已完成、计划中、暂缓三种状态清楚区分；
3. v0.1.0–v0.7.1 的完成情况能追溯到代码或提交；
4. v0.8.0–v1.0.0 不出现虚假的完成结果；
5. R4 的“曾完成、后替代”关系没有丢失；
6. 智谱已接通、Anthropic/OpenAI 未接通、`synth_on_refresh` 未接线等事实保持准确。

检查命令：

```powershell
rg --files docs
rg -n "当前未实现|仅壳|待做|已完成|计划中|暂缓" docs
git diff --check
```

另执行相对 Markdown 链接检查，确认不存在指向已删除文件的链接。

## 8. 非目标

- 不调整软件版本号；
- 不创建 Git tag 或发布包；
- 不修改任何产品功能；
- 不在本阶段修复 v0.8.0 的功能缺口；
- 不把所有代码细节复制进需求文档。
