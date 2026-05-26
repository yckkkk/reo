# Tiptap 官方基线与文件实时同步

## 意图

Reo 的记忆空间应像普通文件夹一样被人类和 Codex-class agent 直接编辑。一般任务只需要改 Markdown、目录名、文件名或必要的 JSON；Reo 负责静默重投影、修复可确定结构、刷新当前界面和保护冲突。用户不应该感知保存机制、刷新机制、sidecar hash 或 `.reo` mirror。

本轮工作把编辑器从“显式保存 + 手动刷新 fallback 是正常路径”迁移到“自动保存 + main-owned 文件变化事件 + Tiptap 官方模型”的当前范式。Tiptap 负责 editor schema、commands、Markdown import/export、toolbar state 和 content error；Reo 只在主题、布局、语言、Markdown 文件真源、`content.tiptap.json` sidecar、Electron 安全边界、本地文件 watcher、IPC、Query 投影和冲突恢复处做薄适配。

## 已锁定

- 首期采用模型替换，不做只加 watcher 或只清理 toolbar 的局部补丁。
- Tiptap 侧以当前官方文档和官方 template 范式为基线；本地改动必须证明属于 Reo 边界薄适配。
- Tiptap UI/template 不允许挑选式接入。不能因为局部 UI 偏好、表面简洁或短期症状，逐个搬运、关闭默认能力或重写内部 primitive；必须先完整对齐官方当前 template/包能力，再由 Reo 在边界层做主题、布局、语言和 Electron/file-truth 适配。
- 如果官方 template 与 Reo 边界无法直接组合，先选择 retokenize、组合、薄适配或明确 fork。fork 必须成为显式长期维护边界，不能伪装成官方 template。
- `@tiptap/markdown` 的 `contentType: "markdown"`、`editor.getMarkdown()`、`editor.getJSON()`、`setContent(..., { emitUpdate: false })` 是编辑器 import/export 的默认路径。
- Tiptap React toolbar 状态应使用窄 selector 的 `useEditorState`，不以整份 editor state 或 ProseMirror 低层 dispatch 作为常规按钮模型。
- Tiptap `contentError` / `enableContentCheck` / `emitContentError` 是 renderer 接收 JSON 时的官方 schema 错误入口。
- main 侧 Markdown 文件真源、Tiptap sidecar、双 baseline CAS、atomic write、per-object queue、workspace lock、manifest rebuild、needs-review 和 Electron IPC 安全边界继续由 Reo 拥有。
- 文件变化的正常触发源由 main process watcher 拥有；visibility refresh、重新选择当前片段、重新点 tab 只作为 fallback。
- watcher event payload 不暴露 raw path；renderer 通过 workspace handle/session 重新读取 file truth 并刷新当前投影。
- autosave 不能静默覆盖外部修改。干净 editor 接受磁盘版本；本地 pending/conflict editor 保留当前输入并进入可见冲突/失败状态。
- Reo 自己写入后的 optimistic patch 可保留用于即时反馈，但 watcher echo 只能作为 durable file truth confirmation，不能破坏 pending delete、rename 或本地编辑状态。

## 必须替换的旧模型

- 新建 Note overlay、inline editor、expanded editor 的显式保存/取消按钮不再是正常编辑路径。
- dirty 不再承担“普通导航阻塞”职责。导航只应在 pending write、conflict、保存失败、未创建 durable target 或上传类不可丢状态时阻塞。
- `inlineMarkdownEditorState` 的 `save-started`、`save-succeeded`、`save-conflicted`、`cancel-clean` 等手动保存语义需要重构为 autosave 状态机。
- `document.visibilitychange`、重新选择当前 Segment、重新点击当前 content tab 不再是外部文件变更显示的正常路径。
- renderer 分散的 exact query invalidation 需要收敛到统一 refresh coordinator，按 watcher event 触发 snapshot/detail/content 重投影。
- 新建 Note 不能只走 Markdown `onChange`，必须和已 finalize content 一样携带 Tiptap JSON / rich sidecar 信息，避免高亮、下划线等 marks 在首存时丢失。
- toolbar hook 中直接操作 ProseMirror selection、`dispatch`、`setTimeout` command 补丁、手动 stored mark 清理的实现，需要回到 Tiptap command/extension 模型或证明来自当前官方 template。
- Tiptap toolbar/template 不做零散修补；逐文件 drift 只能作为盘点结果，实际替换必须以官方当前 template 的完整能力面为单位落地。
- 源码直接 import 的 Tiptap 包必须是显式依赖，不能依赖 transitive hoist。

## 必须保留的 Reo 边界

- Markdown 是普通文件真源；`content.tiptap.json` 是富文本 sidecar，保留高亮色、下划线、上下标、text-align 等 Markdown 难以表达或无法稳定表达的信息。
- 双 hash/baseline 仍是并发写入和外部编辑保护边界；autosave 只是把保存触发下沉为系统行为，不删除 CAS。
- `memoryFiles` / `workspaceFiles` 的 open/read-time rebuild、deterministic repair、needs-review 分类继续作为外部人类/agent 文件操作的收敛层。
- Electron preload 只暴露受控 subscription，不把 `ipcRenderer`、raw event 或 raw path 泄露给 renderer。
- Reo design system 只能 retokenize Tiptap surface、toolbar geometry、颜色变量、语言和布局；不能用设计系统缺陷倒逼 Tiptap 内部 primitive 重写。

## File-truth Refresh 状态机与不可变约束

状态机：

1. `watching`: active workspace handle 持有 main-owned watcher；event coalescing 等待文件变化稳定。
2. `event-received`: preload 向 renderer 发送脱敏 event；renderer 只接受同 workspace handle/session 的事件。
3. `snapshot-refreshing`: renderer 调用 `readWorkspaceSnapshot`，成功后更新 workspace projection。
4. `projection-invalidating`: renderer 使同 workspace 的 Memory detail、Segment content 和 SegmentSupplement content query 失效；same-snapshot body-only 事件也必须进入该状态。
5. `content-refetching`: active observers 从 main 重新读取当前文件真源。
6. `clean-applied`: clean editor 用磁盘 Markdown/Tiptap JSON 更新 Tiptap editor，且使用 `emitUpdate: false` 避免 autosave loop。
7. `dirty-conflict`: local dirty/pending/error/conflict editor 不被磁盘版本覆盖，保留用户输入并暴露可恢复状态。
8. `settled`: watcher echo、query refetch 和 optimistic projection 不再产生额外写入或重复刷新。

不可变约束：

- watcher/preload/event 不暴露 raw path、Electron event、token、handle internals 或正文。
- renderer 不根据 event payload 猜测对象；必须重新读取 main file truth。
- watcher event 不能绕过 baseline CAS，不能静默覆盖本地 dirty 内容。
- 同一 workspace 的 same-snapshot body-only 事件也必须刷新 detail/content，不能依赖 reselect/tab click/visibility。
- reselect、tab click 和 visibility 只作为 missed-event fallback，不是正常路径成功标准。
- `.part`、lock、cache、editor 临时文件和 symlink 路径不能触发不安全投影或 raw-path 诊断。
- E2E 必须拆成小步骤，每步断言关键副作用：文件变化、read model 投影、manifest/hash/sidecar 收敛、UI/query 刷新或 needs-review 分类；不能只断言最终页面存在某个文本。

## 官方基线

- Tiptap Markdown: 初始 Markdown content 使用 `contentType: "markdown"`；读取使用 `editor.getMarkdown()`；替换内容使用 `editor.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false })` 避免外部刷新触发 update loop。
- Tiptap events: 本地编辑通过 `onUpdate` 或 `transaction.docChanged` 进入 autosave pipeline；外部 prop 更新通过 `setContent(..., emitUpdate: false)` 进入 editor。
- Tiptap React performance: toolbar 和状态 UI 使用 `useEditorState` 选择具体状态，例如 active marks、can-run、selection type，而不是让整棵 editor UI 随每次 transaction 重渲染。
- Tiptap schema errors: renderer 接收 JSON 时接入 `contentError`，并把 invalid JSON/unsupported node/unsupported mark 转为 Reo 可见恢复状态，而不是只依赖 main sidecar 校验。
- Electron IPC: preload wrapper 只向 renderer callback 传必要 payload，不传 Electron event 对象。
- TanStack Query: 外部事件到达后使用 `invalidateQueries` 或集中 refresh coordinator 标记相关 query stale，并让 active observers 后台 refetch。

## 成功标准

- Codex 或人类直接修改当前可见 Segment/Supplement Markdown 后，Reo 无需用户点击片段流、tab 或刷新页面即可显示新内容。
- 直接创建、重命名、移动 Memory、Segment、SegmentSupplement 后，Reo 在 watcher settlement 后静默更新 rail、detail 和当前 studio 投影。
- clean editor 收到外部正文/sidecar 变化时静默更新 Tiptap 内容，不触发 autosave loop。
- 正在本地编辑且尚未落盘时收到外部变化，Reo 不覆盖当前输入，并显示可恢复的冲突/失败状态。
- 新建 Note/Supplement 的首存能保留 Tiptap JSON rich marks，至少覆盖 toolbar 中当前可见的高亮色、下划线、上下标、link、heading、list、code、blockquote、alignment。
- toolbar 高亮、下划线、标题等能力的读写以 Tiptap command/schema/Markdown extension 为准，Codex 直接编辑 Markdown 或 sidecar 后 Reo 能识别和呈现。
- visibility refresh、reselect 和 tab-click refresh 仍可作为 watcher missed event 的 fallback，但测试命名和断言不再把它们定义为正常路径。
- `npm run verify:quick` 在最终提交前通过。

## 非目标

- 不改变当前编辑器视觉风格、预览风格或 toolbar 信息架构，除非为了消除 Tiptap drift 必须调整内部实现。
- 不把 Codex 或人类限制为只能编辑 Markdown；JSON 和 `.reo` 仍可用于高级恢复和异常测试。
- 不引入协同编辑、多人实时光标或 CRDT。
- 不把 watcher 做成通用 speculative runtime；只服务当前 active workspace 的文件真源同步。
- 不删除 Reo 的 sidecar、CAS、atomic write 或 needs-review 机制。

## 来源

- Tiptap official docs: Markdown `contentType` / `getMarkdown` / `setContent`、React `useEditorState`、schema `contentError`。
- Electron official docs: `contextBridge` 安全暴露 IPC event，避免泄露 raw `ipcRenderer` 或 event。
- TanStack Query official docs: `invalidateQueries` 默认标记 stale 并 refetch active queries。
- 本轮只读审查：Tiptap 官方模型 drift、显式保存/dirty blocker、watcher/live refresh 三个方向的源码盘点。
