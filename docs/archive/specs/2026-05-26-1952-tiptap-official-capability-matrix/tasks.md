# Tasks

## 成功标准

- 支持矩阵覆盖高亮颜色、下划线、上下标、link、heading、list、code、blockquote 和 alignment。
- 每个能力都有 Markdown 表达、`content.tiptap.json` 表达、当前 Reo read/write/roundtrip 状态和推荐最短外部编辑路径。
- 补齐后，一般 agent/human 任务优先编辑 `memories/` 下普通 Markdown；只有精确富结构或异常恢复才需要编辑 `content.tiptap.json`。
- 外部修改 Markdown 或 `content.tiptap.json` 后，当前 UI 通过 file truth event 和 Query refetch 静默收敛，不需要点击横向片段流或刷新页面。
- E2E / renderer 验证拆成小测试，不做一个大流程假覆盖。

## Phase 1: 盘点与 spec

- [x] 读取 Reo 文档入口、current 数据/前端/流程/质量真源。
- [x] 通过 Context7 查询 Tiptap 官方 Markdown extension、MarkdownManager、extension Markdown integration、Highlight/TextAlign 资料。
- [x] 核对当前 package、codec、sidecar、editor surface、workspace agent template 和现有测试。
- [x] 引入 subagent 源码盘点结果，识别当前能力和测试缺口。
- [x] 建立支持矩阵、状态机、不变量和首期补齐范围。
- [x] 使用 subagent review spec：官方/Tiptap 完整性。
- [x] 使用 subagent review spec：Reo 实现可执行性和测试切片。
- [x] 根据 review 修订 spec。

## Phase 2: agent/human 最短路径补齐

- [x] 扩展 `src/main/workspaceFiles.ts` 中 `DEFAULT_REO_EDIT_SKILL_MD` 的 Rich Text Markdown 章节；该模板生成记忆空间内 `skills/reo-edit/SKILL.md`。
  - [x] 覆盖普通高亮、彩色高亮、下划线、上下标、link、heading、bullet/ordered/task list、inline code、fenced code block、blockquote、alignment。
  - [x] 明确普通任务不维护 hash、manifest 或 sidecar。
  - [x] 明确专家路径可编辑同节点 `content.tiptap.json` 的 `content` 字段，但 Reo 只自动接受可无损序列化的 profile 内容；agent 不维护 `source.hash` 或 `contentHash`。
- [x] 更新 `test/main/workspaceFiles.test.ts` 对新模板内容做 focused 断言。
- [x] 如 current 能力索引需要稳定更新，只压缩写入 `docs/current/data.md`、`docs/current/frontend.md` 或 `docs/current/quality.md`，不搬运任务过程。

## Phase 3: codec / sidecar focused matrix

- [x] 扩展 `test/main/tiptapContentSidecar.test.ts`，用小表覆盖 helper 级 JSON-only sidecar 修改到 Markdown 的关键能力。
  - [x] link。
  - [x] heading。
  - [x] bullet/ordered/task list。
  - [x] inline code 和 code block。
  - [x] blockquote。
  - [x] paragraph/heading alignment。
- [x] 若测试暴露 codec/profile 缺口，先记录 RED，再最小修改 `src/main/tiptapMarkdownCodec.ts` 或 `src/tiptap-markdown/*`。
- [x] 保持 unsupported Tiptap content、非法 highlight color、危险 link attr 和 invalid sidecar 不写 Markdown 的保护。

## Phase 4: toolbar 写入小测试

- [x] 扩展 `src/renderer/src/workspace/LightweightMarkdownEditorSurface.test.tsx`，每个测试只断言一个关键写入面。
  - [x] heading dropdown H1-H4 写出 Markdown，并抽查 Tiptap JSON heading level。
  - [x] ordinary highlight 写出 `==text==` 或同等无色 highlight JSON mark。
  - [x] marks: underline、superscript、subscript、inline code。
  - [x] link apply 写出 Markdown 和 JSON；remove 依赖 Tiptap link selection，当前不在 JSDOM 中用伪 selection 断言。
  - [x] block commands: blockquote、code block。
  - [x] list commands: task list 写出 `- [ ]` / `- [x]`。
  - [x] alignment commands 写出 HTML-compatible Markdown block。
- [x] 若 UI button 测试只能证明按钮存在，改为断言 `editor.getMarkdown()` 或 `onRichChange.markdown` 输出。
- [x] 对每组 mark/node 能力至少抽查 `onRichChange.tiptapJson` 或 editor JSON，证明 sidecar 表达链路存在。
- [x] 不绑定无意义 DOM class；只断言用户可见命令结果和 Markdown/JSON 输出。

## Phase 5: live sync focused verification

- [x] 先列小状态转移，不写单个大 E2E。
- [x] Renderer focused test：当前 clean editor 收到同 workspace file truth event 后，selected note content refetch 并显示外部 Markdown 更新。
- [x] Renderer focused test：外部 `content.tiptap.json` 变更为彩色高亮 + 下划线后，必须通过 `window.reoWorkspace.onFileTruthChanged`、`readWorkspaceSnapshot` 和 selected `readSegmentContent` refetch 显示新正文和对应 mark，不能只 rerender editor props；同一 invalidation predicate 覆盖 selected `readSegmentSupplementContent` query key。
- [x] Main / IPC focused test：外部 `content.tiptap.json` JSON-only 修改触发 read content 期间的 Markdown mirror，并更新 sidecar baseline；不要与 Phase 3 的 helper 级 reconcile 测试重复。
- [x] 如果需要真实 runtime 证明，再用测试记忆空间做人工/CLI 分步验证，每一步记录文件副作用和 UI 投影。

## Phase 6: 收口

- [x] 跑相关 focused tests。
- [x] 跑 `npm run verify:quick`。
- [x] 简化审查：删除重复逻辑、无用测试脚手架、过宽断言和 spec 中不再需要的执行噪声。
- [x] 若长期事实发生变化，压缩更新 `docs/current/*`；本轮稳定能力索引已在 current 文档存在，任务证据留在 spec。
- [x] 完成后归档 spec；本轮没有需要 initiative 承接的未完成长期项。
