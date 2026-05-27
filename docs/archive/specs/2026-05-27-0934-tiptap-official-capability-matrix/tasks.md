# 执行清单

## Phase 0 — 启动与依据

- [x] 重读 `AGENTS.md`。
- [x] 确认 `docs/specs` 为空。
- [x] 通过 `request_user_input` 对齐本轮优先级为「合同矩阵优先」。
- [x] 使用 Context7 查询 Tiptap 官方当前文档。
- [x] 核对本地 `.reference/tiptap` 与 `.reference/tiptap-docs`。
- [x] 创建 active spec。

Evidence:

- `date '+%Y-%m-%d-%H%M %Z'`
- `git status --short`
- `find docs/specs -mindepth 1 -maxdepth 1 -print`

## Phase 1 — 官方能力与当前覆盖审计

- [x] 审计 main codec：`parseTiptapMarkdown` / `serializeTiptapMarkdown` / durable profile allowlist。
- [x] 审计 sidecar reconcile：missing、Markdown-only、JSON-only、conflict、invalid、unsupported。
- [x] 审计 renderer editor：`setContent(..., contentType: 'markdown')`、`getMarkdown()`、`getJSON()`、toolbar 暴露与 unsupported JSON error。
- [x] 审计 file truth refresh：snapshot passive reconcile、selected content Query invalidation、needs-review report。
- [x] 等待 subagent 官方模型审查结果并合并有效发现。

Evidence:

- `git -C .reference/tiptap pull --ff-only`
- `git -C .reference/tiptap-docs pull --ff-only`
- Subagent `019e6a4a-9fc7-7130-a659-95190803b443` reported the durable attr validation gap, extended highlight token gap, unsafe link gap, and recommended focused TDD.

## Phase 2 — RED：缺口测试

- [x] Main codec matrix RED：补齐未覆盖或覆盖不足的 Markdown/JSON roundtrip 能力。
- [x] Sidecar RED：补齐 JSON-only durable matrix 与 unsafe attrs/recovery 场景。
- [x] Workspace refresh RED：补齐 sidecar-authored 外部修改后的文件变化、snapshot 收敛与 report 副作用。
- [x] Renderer RED：补齐 UI 投影与 unsafe link 小场景。
- [x] Doctor/recovery RED：沿用 needs-review report 与 workspace-relative 输出场景，并补官方 attr needs-review report 场景。

Evidence:

- `MAIN_TEST_FILES=tiptapMarkdownCodec.test.ts npm run test:main -- --test-name-pattern "highlight token|official-incompatible"` first failed on missing official-incompatible attr rejection.
- `MAIN_TEST_FILES=tiptapContentSidecar.test.ts npm run test:main -- --test-name-pattern "official-incompatible|markdown-derived"` first failed on unsupported sidecar/Markdown-derived content being accepted.

## Phase 3 — GREEN：最小实现

- [x] 只在官方模型和 Reo 边界层补实现，不重写 Tiptap primitive。
- [x] 保持 Markdown 文件默认可由普通 agent 编辑。
- [x] 保持 renderer/preload 不暴露 raw path 或 report entries。
- [x] 保持 unsupported/invalid/conflict 不自动合并。

Implementation:

- Extended durable highlight colors to the full Reo Simple Editor toolbar set, excluding `var(--tt-bg-color)` because it is a clear action.
- Added shared durable link href validation and reused it in renderer link set/open and main Markdown serialization.
- Tightened durable attr validation for heading level, text align, ordered list start, task checked, code language, image attrs, and link href/title.
- Validated parsed Markdown-derived Tiptap JSON before creating or regenerating a sidecar, so unsafe Markdown-derived content enters `unsupported-tiptap-content`.

## Phase 4 — 小场景 E2E / 集成验证

- [x] 小场景 1：Markdown-only external edit 生成 sidecar 并刷新 UI。
- [x] 小场景 2：Sidecar JSON-only edit 写回 Markdown 并刷新 UI。
- [x] 小场景 3：Audio Segment transcript sidecar JSON-only edit 写回 Markdown。
- [x] 小场景 4：Audio SegmentSupplement transcript sidecar JSON-only edit 写回 Markdown。
- [x] 小场景 5：Unsupported sidecar 写入 needs-review report，snapshot 只暴露 aggregate count。
- [x] 小场景 6：doctor 输出 workspace-relative paths。

Evidence:

- `MAIN_TEST_FILES=tiptapMarkdownCodec.test.ts,tiptapContentSidecar.test.ts npm run test:main`
- `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "passive sidecar|sidecar|needs-review|reo-doctor"`
- `MAIN_TEST_FILES=recordingDrafts.test.ts,noteDrafts.test.ts npm run test:main -- --test-name-pattern "tiptap|sidecar|highlight|underline|transcript"`
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LightweightMarkdownEditorSurface.test.tsx`
- `npm run typecheck:quick`

## Phase 5 — 审查与简化

- [x] 使用 subagent xhigh 做 spec/code 审查。
- [x] 使用 subagent xhigh 做简化/复用审查。
- [x] 修复所有 blocker/major 和合理的 important 问题。
- [x] 自问是否 100% 有事实信心；若没有，继续列漏洞、修复、复测。

Review findings fixed:

- Unknown `false` attrs and typed empty-string attrs no longer pass durable validation.
- Durable link href validation is separate from external-open validation; relative Markdown links can persist, but they are not sent to `workspace:openMarkdownExternalLink`.
- Main and renderer Tiptap Link extensions use the official `isAllowedUri` hook.
- Link helper internals share bounded normalization and absolute `http/https` parsing.
- Text align values and heading levels reuse shared Tiptap profile constants.
- `assertTiptapJsonMatchesMarkdown()` no longer walks the same Tiptap JSON twice before serialization.
- Workspace needs-review test merges unsupported table and official-incompatible attr sidecars into one file-truth scenario.

Evidence:

- Subagent `019e6a63-567a-7150-b031-18040a49ffba` defect review.
- Subagent `019e6a63-9da7-7f32-82b1-f7210e30bb8d` simplification review.
- Subagent `019e6a6f-3f31-7360-b160-9a47f63092a9` reuse review.
- Subagent `019e6a6f-3fdd-7673-8caf-5a54cb113087` code-quality review.
- Subagent `019e6a6f-40aa-7673-b976-fb7f573f60bc` efficiency review.
- `MAIN_TEST_FILES=tiptapMarkdownCodec.test.ts,tiptapContentSidecar.test.ts npm run test:main`
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LightweightMarkdownEditorSurface.test.tsx --testNamePattern "link|durable sidecar"`
- `MAIN_TEST_FILES=workspaceFiles.test.ts npm run test:main -- --test-name-pattern "preserves invalid and unsupported sidecars|passive sidecar|needs-review|reo-doctor"`
- `MAIN_TEST_FILES=workspaceIpcRegistration.test.ts,workspaceContract.test.ts npm run test:main -- --test-name-pattern "Markdown external link|openMarkdownExternalLink|external link"`
- `MAIN_TEST_FILES=recordingDrafts.test.ts,noteDrafts.test.ts npm run test:main -- --test-name-pattern "tiptap|sidecar|highlight|underline|transcript"`
- `npm run typecheck:quick`
- `npm run lint:strict -- --quiet`
- `git diff --check`

## Phase 6 — 收口

- [x] 更新 `docs/current/*` 中仍然稳定的长期事实。
- [x] 归档 active spec。
- [x] `npm run verify:quick`
- [x] `git diff --check`
- [x] 提交。
- [x] 自动进入下一个已确定 spec 队列。

Final evidence:

- `git diff --check`
- `npm run verify:quick`
- Commit: see git history for this spec closeout.

## 不能做

- [ ] 不写一个覆盖全部 Tiptap 路径的大 E2E。
- [ ] 不把 agent 的复杂思考路径作为产品合同。
- [ ] 不限制 agent 只能编辑 Markdown；JSON sidecar、目录名和对象文件仍按文件合同处理。
- [ ] 不新增 generic IPC、raw path IPC 或 renderer report entries。
- [ ] 不把 Tiptap 官方能力替换成 Reo 自研内部模型。
