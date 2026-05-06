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
