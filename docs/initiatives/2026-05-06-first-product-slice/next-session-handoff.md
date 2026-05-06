# Next Session Handoff

## 目标

设定 `$goal`：完成 Reo first product slice 的完整长任务交付。

执行顺序必须先完成 design-hardening gate。该 gate 未通过前，不实现代码、不安装依赖、不执行 Slice 1。gate 通过后，使用 `$writing-plans` 写出 reconciled implementation plan，再用 `$plan-eng-review` 审查到无 unresolved BLOCKER/MAJOR，最后才使用 `$executing-plans` 进入实现。

## 读取顺序

1. `AGENTS.md`
2. `README.md`
3. `docs/README.md`
4. `docs/current/foundation.md`
5. `docs/current/architecture.md`
6. `docs/current/electron.md`
7. `docs/current/data.md`
8. `docs/current/flow.md`
9. `docs/current/frontend.md`
10. `docs/current/quality.md`
11. `docs/initiatives/2026-05-06-first-product-slice/README.md`
12. `docs/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
13. `docs/initiatives/2026-05-06-first-product-slice/plan.md`
14. `docs/initiatives/2026-05-06-first-product-slice/tasks.md`

`.claude/CLAUDE.md` 与 `AGENTS.md` 是镜像文件。Claude worker 可读任一入口，但必须确认两者一致。

读取 archived spec 或 archived plan 前，必须先完成以上 active/current 文件。Archived plan 不能作为 Slice 命名、顺序或执行来源。

## 背景材料

以下文件只作为产品背景、参考素材和历史审查证据；当前执行权威是 active initiative、design-hardening spec 和 `docs/current/*`：

- `docs/archive/specs/2026-05-06-0100-first-product-slice/spec.md`
- `docs/archive/specs/2026-05-06-0116-first-product-slice-plan/plan.md`

## 参考素材

必须核对：

- `/Users/yck/Downloads/PM/设计参考/记忆录音/`
- `/private/tmp/reo-reference-frames/`

只吸收结构、层级、状态和 micro-interactions。视觉系统服从 Reo design system。

必须核对外部资料：

- 使用 Context7 查 Electron、shadcn/ui、TanStack Query 等被 design-hardening 触发的官方文档。
- 使用网络搜索核对当年主流 product UI/design system 做法，结论只能作为设计输入，不能替代 Reo design system。
- 使用 GitHub 搜索和仓库查看核对是否存在可复用开源实现；能复用成熟方案时不重复造轮子。
- 所有前端组件、overlay/drawer、audio/media、editor、main process capability、IPC/preload typing、filesystem transaction、file watching、schema validation、state machine、form handling、data fetching、DB/migration、testing/QA、logging/observability 和 packaging/updater 能力必须先评估成熟开源包或官方方案；能复用时优先复用。
- Audio/agent UI 必须优先评估 ElevenLabs UI：`https://ui.elevenlabs.io/`、`https://ui.elevenlabs.io/docs/components`。
- Recording overlay 必须评估 `/Users/yck/Downloads/PM/设计参考/记忆录音/Drawer with ElevenLabs audio component.mp4`，并把抽帧证据写入 `reference-map.md`。
- ElevenLabs UI 候选至少包括 Audio Player、Live Waveform、Waveform、Speech Input、Transcript Viewer、Voice Button；不能 `add all`，只能逐组件评估和引入。
- Bottom drawer / large modal mechanics 必须评估 Vaul 或 shadcn drawer。
- Recording、waveform、playback、scrubber 必须评估 wavesurfer.js、ElevenLabs UI 和至少一个其他成熟 audio package。
- 发现现成方案不完全适配时，必须先评估裁剪、retokenize、组合、薄适配或 fork；不能直接放弃开源方案改自研。
- 任何自研决定都必须写明被拒绝的现成方案、已评估的适配路径、拒绝原因、风险和替代设计。自研只能是最后手段。
- Obsidian 主程序不是直接可复用的开源代码来源；本任务只借鉴 vault 文件夹、附件、普通文件可读和 workspace 管理模型。

## 必须产出

创建：

```text
docs/specs/YYYY-MM-DD-HHMM-first-product-slice-design-hardening/
```

至少包含：

- `requirements.md`
- `traceability-matrix.md`
- `ui-blueprint.md`
- `reference-map.md`
- `external-research.md`
- `reuse-decisions.md`
- `accessibility-matrix.md`
- `architecture-views.md`
- `data-contracts.md`
- `filesystem-transactions.md`
- `protocol-contracts.md`
- `security-threat-model.md`
- `state-machines.md`
- `qa-matrix.md`
- `foundation-decisions.md`
- `code-simplicity.md`
- `implementation-plan-reconciliation.md`
- `new-session-handoff.md`
- `review.md`
- `verification.md`

## 硬边界

- 不实现代码。
- 不安装依赖。
- 不进入 Renderer Test Foundation。
- 不创建 generic runtime、generic service layer、generic IPC bridge。
- 不显示未实现的 photo、video、file、film 能力。
- 不把 DB 当作用户内容真源。
- 不初始化 shadcn/ui，除非 design-hardening 已列出 exact primitive、business component consumer、shared invariant、slice 和 tests。
- UI 不使用 emoji；icon-only controls 使用 lucide。

## 必须回答

- 哪些 foundation 在 first product slice 必须建立，为什么。
- 哪些 foundation 只需要 design decision，暂不建立，为什么。
- `reuse-decisions.md` 是否逐项覆盖 UI primitives、page/overlay primitives、recording controls、waveform/progress、audio playback/editor、transcription mock seam、IPC/preload typing、filesystem atomic write、file watching、schema validation、state machine、form/schema、data fetching、DB/migration、testing/QA、logging/observability、packaging/updater，并列出 adopted package 或 rejected packages。
- 前端组件 taxonomy、layout primitives、UI primitives、feature components、复用边界是什么。
- Sidebar 第一版是否显示；如果显示，内容、宽度、responsive behavior、keyboard model 和 tests 是什么。
- 参考图的结构如何映射到 Reo 页面和组件，而不是被复制成一次性效果。
- DB conceptual model 与 physical schema 的边界是什么。
- 每个 durable field 的语义、owner、是否可重建、失败时保留策略是什么。
- 每个 workspace filesystem write 的 atomic temp/rename、ordering、crash window、idempotency、single-writer、partial cleanup 和 recovery 是什么。
- 同一 workspace 被多个 window 或进程打开时，cross-process lock、检测、拒绝或合并语义是什么。
- Workspace 文件结构如何支撑 Codex CLI 读取。
- 每个 requirement 对应的 preload method、IPC channel、request、response、error、timeout、cancellation、sender validation、permission effect、state/query owner 和 tests 是什么。
- Workspace、recording、autosave、playback、recovery 状态机是什么。
- 状态归属矩阵是什么，如何避免同一事实重复存储。
- 如何减少复杂性、嵌套、冗余代码和过度抽象，同时保留已接受功能。
- Security threat model 如何用 STRIDE-by-asset 覆盖 workspace folder、IPC、preload、custom protocol、renderer window、audio artifact、metadata files；每个 threat 的 attack path、mitigation/prevention、detection/recovery、negative test 或 manual verification、owner、residual risk 是什么。
- 哪些测试是 RED/GREEN/REFACTOR，哪些是操作验证。
- 哪些操作验证必须使用 Computer Use。
- Reference assets 对照清单是什么。

## 完成条件

- design-hardening spec 通过自审和独立对抗审查，且没有 unresolved BLOCKER/MAJOR。
- active initiative 更新下一步。
- archived implementation plan 保持历史证据，不得编辑；`implementation-plan-reconciliation.md` 已记录 archived plan delta、supersession decisions 和 `$writing-plans` 输入。
- design-hardening gate 通过后，另行使用 `$writing-plans` 产出可执行的 reconciled implementation plan。
- reconciled implementation plan 已通过 `$writing-plans` 格式要求和 `$plan-eng-review` 工程审查。
- 长期结论压缩回 `docs/current/*` 或 `docs/decisions/*`；initiative 只保留跨 session 进度和读取入口。
- `npm run verify:quick` 通过。
- `git diff --check` 通过。
- `diff -u AGENTS.md .claude/CLAUDE.md` 通过。
- 提交一个 docs commit。
