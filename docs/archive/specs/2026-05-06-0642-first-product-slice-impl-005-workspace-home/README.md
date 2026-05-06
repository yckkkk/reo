# IMPL-005 Workspace home UI 和最小 shadcn primitives

创建时间：2026-05-06 06:42 America/Los_Angeles

## 目标

本切片完成 workspace loaded state 的第一版 home UI，并首次初始化最小 shadcn/ui source。home 只展示当前已实现能力：workspace title、单一 record action、`Memory Content`、recording 空状态和 recording list 容器。

## shadcn gate

- Exact primitives：Button、Label。
- Business component consumer：`CreateWorkspaceForm` 使用 Button/Label；`WorkspaceHome` 使用 Button。
- Shared invariant：Reo button 保持 rounded pill、explicit focus-visible、disabled state；Label 保持可访问 form label 和 Reo body typography。
- Slice：只服务 workspace creation 和 workspace home，不引入 overlay、drawer、tooltip、card、dialog、textarea。
- Tests：Button/Label primitive tests、CreateWorkspaceForm regression tests、WorkspaceHome behavior tests、ForbiddenCapabilities tests。

## 非范围

- 不实现 recording overlay、MediaRecorder、Dialog、Textarea、playback、autosave。
- 不添加 Tooltip，因为本切片没有 icon-only control。
- 不添加 Vaul、drawer、wavesurfer 或 ElevenLabs UI source。
- 不显示 photo、video、file、film、search、tag、share、sync 等未来能力。

## 完成条件

- RED -> GREEN -> REFACTOR 证据写入 `tdd.md`。
- `components.json`、renderer alias、Button/Label source、business consumers 和 tests 同批落地。
- `npm run test:renderer`、`npm run verify:quick` 通过。
- 记录 reference evidence：home 采用居中标题、单 record action、content grid，拒绝未来 controls。
- 更新 `docs/current/frontend.md`。
- spec 完成后归档，active `docs/specs/*` 清空。
