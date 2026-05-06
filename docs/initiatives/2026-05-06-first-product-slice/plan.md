# Plan

## 执行顺序

按照 archived implementation plan 执行，不允许合并 slices：

1. Renderer Test Foundation
2. Preload + Trusted IPC + Zod Foundation
3. Workspace IPC + Filesystem + Recording Draft Foundation
4. Renderer Workspace Data And Create Form
5. Workspace Home UI + shadcn Foundation
6. Recording Overlay, MediaRecorder And Autosave
7. Runtime, Persistence And Codex CLI Validation

## 规则

- 每个 slice 必须创建自己的 `docs/specs/YYYY-MM-DD-HHMM-slug/`。
- 每个 slice 完成后归档自己的 session spec。
- 如果某个 slice 未完成，该 slice spec 留在 `docs/specs/*`，不能 archive-only。
- 每个 slice 必须提交后才能进入下一 slice。
- 不得跳过 foundation slice 直接实现产品 UI。

## 每个 Slice 的必检问题

每个 slice spec 必须明确回答：

- DB schema：本 slice 是否引入 schema、migration 或 tables；如果不引入，为什么。
- 表关系：涉及哪些实体、relationship、cardinality、ownership、delete/update effect。
- 数据获取模式：TanStack Query、component state、filesystem scan、IPC request/response 的 owner 和 invalidation。
- 可复用组件：哪些是 reusable primitives，哪些是 feature-local；真实 consumer 和 invariant 是什么。
- 文件夹结构：用户文件、Reo metadata、rebuildable index、临时文件和恢复路径。
- 错误处理：用户可见错误、内部诊断、失败时保留的数据、retry/recovery 行为。
