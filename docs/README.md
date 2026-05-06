# Reo 文档入口

文档优先服务 agent。目标是减少误判，而不是堆叠知识库；精简服从交接、收口和验证。

## 默认阅读

每次任务读取：

1. `../AGENTS.md`
2. `../README.md`
3. `current/foundation.md`
4. `current/architecture.md`

然后只读取与改动范围匹配的 current 真源：

- Electron surface：`current/electron.md`
- 数据与状态归属：`current/data.md`
- 流程与时序：`current/flow.md`
- 前端、组件与设计系统：`current/frontend.md`
- 质量门槛：`current/quality.md`

## 结构

```text
docs/
  archive/     已收口任务记录
  current/     当前实现与设计真源
    design-system/ 当前设计系统源文件
  decisions/   长期架构决策
  initiatives/ 跨 session 长期任务
  specs/       当前任务工作区
```

归档子目录在首次写入时创建；不保留空占位目录。

## Initiatives

跨多个 session 的长期任务使用：

```text
docs/initiatives/YYYY-MM-DD-slug/
```

`docs/initiatives/README.md` 只记录 active initiative 索引和读取入口。默认最多 1 个 active initiative。

Initiative 必须有明确完成条件。完成、取消或失效后移入：

```text
docs/archive/initiatives/YYYY-MM-DD-slug/
```

Initiative 不能覆盖 `current/*` 或 `decisions/*`，也不能替代当前 slice spec。

长期任务的完成条件或范围不再匹配当前任务时，创建新的 initiative。

创建新 spec 前，必须确认 `docs/specs/*` 为空或只包含当前任务。

## 任务 Specs

任务 spec 路径格式：

```text
docs/specs/YYYY-MM-DD-HHMM-slug/
```

使用本机时区，并在 spec `README.md` 中显式写出 timezone。

已完成 specs 移入：

```text
docs/archive/specs/YYYY-MM-DD-HHMM-slug/
```

归档 specs 是任务记录，不是默认阅读内容，也不能覆盖 `current/*`。

未完成的 spec 不能只存在于 `archive/specs/*`。只有当前 spec objective 已完成、取消或被明确 supersede，才允许归档。

如果 spec 完成的是 plan，而 plan 指向的产品、实现或长期工作尚未完成，归档前必须先创建或更新 active initiative 来承接剩余工作；否则该 spec 留在 `docs/specs/*`。

`archive/specs/*` 是已收口 session 证据，不是未完成工作的追踪位置。

## 收口压缩

任务收口时：

1. 把仍然有效的长期事实写回 `current/*`。
2. 把长期架构决策写入 `decisions/*`。
3. 把任务证据移入 `archive/specs/*`。
4. 如果任务仍有跨 session 剩余工作，先创建或更新 active initiative，再归档 session spec。
5. 如存在对应 initiative，更新状态和下一步。
6. 已完成、取消或失效的 initiative 移入 `archive/initiatives/*`。
7. 除非用户明确要求，不创建额外顶层 docs 目录。

写入 `current/*` 时只保留当前行为、边界、接口、设计约束和稳定事实。任务证据、执行清单和临时 TODO 留在 spec 或 archive。
