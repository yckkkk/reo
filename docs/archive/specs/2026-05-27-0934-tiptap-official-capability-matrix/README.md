# Tiptap 官方能力完整性矩阵

Timezone: America/Los_Angeles

## 目标

证明 Reo 当前 Tiptap-backed Markdown 编辑能力按官方 Tiptap 3 / `@tiptap/markdown` 模型完整接入，并补齐影响真实工作流的缺口。重点是合同矩阵与小场景验证：Markdown 文件、同节点 `content.tiptap.json`、main 侧 roundtrip、renderer 投影、needs-review recovery 必须表达同一组能力。

本轮不做编辑器大改版，不做自动猜测合并，不引入新富文本系统，不把 Tiptap 官方模型搬成 Reo 自研模型。

## 官方依据

- Context7: `/ueberdosis/tiptap-docs`、`/llmstxt/tiptap_dev_llms_txt`、`/websites/tiptap_dev`
- Local reference:
  - `.reference/tiptap`
  - `.reference/tiptap-docs`

采用依据：

- `MarkdownManager` 是官方 Markdown parse/serialize 独立模型。
- Tiptap extension 通过 `parseMarkdown`、`renderMarkdown`、`markdownTokenizer` 和 `markdownOptions` 参与 Markdown 支持。
- `editor.commands.setContent(markdown, { contentType: 'markdown' })`、`editor.getMarkdown()`、`editor.getJSON()` 是 renderer 编辑态同步入口。
- Reo 的适配只发生在主题、附件 URL、Electron 安全、文件真源、sidecar profile、有限颜色白名单和 recovery surface。

## 状态机

```text
Clean Markdown
  -> read/reconcile
  -> Markdown parse creates content.tiptap.json
  -> UI renders Tiptap JSON + Markdown projection
  -> autosave writes Markdown + sidecar
  -> Clean Markdown

Clean Markdown + Clean Sidecar
  -> sidecar JSON-only supported edit
  -> passive reconcile serializes JSON back to Markdown
  -> snapshot/content/detail converge
  -> UI refreshes projection

Clean Markdown + Clean Sidecar
  -> Markdown-only external edit
  -> sidecar regenerated from Markdown
  -> snapshot/content/detail converge
  -> UI refreshes projection

Clean Markdown + Clean Sidecar
  -> Markdown and sidecar both changed
  -> no automatic merge
  -> needs-review report updated
  -> snapshot exposes aggregate count only
  -> toast/doctor recovery path

Clean Markdown + Unsupported/Invalid Sidecar
  -> passive reconcile refuses overwrite
  -> needs-review report updated
  -> snapshot exposes aggregate count only
  -> doctor gives workspace-relative paths
```

## 不可变约束

- Markdown 文件仍是普通 agent / 人类默认编辑入口；`content.tiptap.json` 是同节点富结构载体，不是用户语义第二真源。
- Renderer 不接收 raw path、report entries、root path、hash 列表或 sidecar 内部诊断。
- Reo 不关闭 Tiptap StarterKit 的标准 block、mark、keymap、input rule 能力；只在需要 Markdown 序列化或 Reo 安全边界时薄适配。
- 所有 `@tiptap/*` package 使用同一版本线，不能新增不匹配版本。
- Durable profile 只接受当前可 roundtrip 且可诊断的节点、mark 和 attrs。
- Colored highlight 只接受 Reo toolbar 暴露的 `var(--tt-color-highlight-*)` 变量；外部任意 CSS color 不进入 durable JSON/Markdown 合同。
- Link durable attrs 只保留官方 `href` / `title` 与默认安全 attrs；不接受 `_self`、事件属性、class 或未知 attrs。
- Unsupported Tiptap JSON、invalid sidecar、双方同时变更和无法写回 Markdown 必须进入 needs-review，不覆盖任一方。
- E2E 不能是一个大流程；必须拆成小场景，每个场景断言一个关键转移和副作用。

## 能力矩阵

| 能力                            | Markdown 输入                            | Sidecar JSON                | Renderer toolbar/UI | Roundtrip                                | Recovery                                         |
| ------------------------------- | ---------------------------------------- | --------------------------- | ------------------- | ---------------------------------------- | ------------------------------------------------ |
| heading H1-H4 UI / H1-H6 kernel | `#` 到 `######`                          | `heading.level`             | dropdown 暴露 H1-H4 | 标准 Markdown；aligned heading 用 HTML   | invalid level / attrs rejected                   |
| paragraph                       | plain text                               | `paragraph`                 | editor body         | 标准 Markdown；aligned paragraph 用 HTML | unknown attrs rejected                           |
| bold                            | `**text**` / HTML strong                 | `bold` mark                 | toolbar             | 标准 Markdown                            | unknown attrs rejected                           |
| italic                          | `*text*` / HTML em                       | `italic` mark               | toolbar             | 标准 Markdown                            | unknown attrs rejected                           |
| strike                          | `~~text~~` / HTML s                      | `strike` mark               | toolbar             | 标准 Markdown                            | unknown attrs rejected                           |
| inline code                     | `` `code` `` / HTML code                 | `code` mark                 | toolbar             | 标准 Markdown                            | unknown attrs rejected                           |
| underline                       | `++text++` / HTML u                      | `underline` mark            | toolbar             | Reo Markdown profile                     | unknown attrs rejected                           |
| highlight                       | `==text==`                               | `highlight` mark            | toolbar             | standard highlight syntax                | invalid attrs rejected                           |
| colored highlight               | `<mark data-color=...>`                  | `highlight.color` allowlist | color popover       | HTML-compatible Markdown                 | non-allowlist color rejected / stripped on parse |
| link                            | `[text](https://...)` / `<a href title>` | `link.href/title`           | link popover        | standard Markdown                        | unsafe/non-durable attrs rejected                |
| superscript                     | `<sup>text</sup>`                        | `superscript` mark          | toolbar             | HTML-compatible Markdown                 | unknown attrs rejected                           |
| subscript                       | `<sub>text</sub>`                        | `subscript` mark            | toolbar             | HTML-compatible Markdown                 | unknown attrs rejected                           |
| bullet list                     | `- item`                                 | `bulletList/listItem`       | list dropdown       | standard Markdown                        | unsupported attrs rejected                       |
| ordered list                    | `1. item` / `start`                      | `orderedList.start`         | list dropdown       | standard Markdown                        | unsupported attrs rejected                       |
| task list                       | `- [ ] item` / `- [x] item`              | `taskList/taskItem.checked` | list dropdown       | GFM Markdown                             | unsupported attrs rejected                       |
| blockquote                      | `> quote`                                | `blockquote`                | toolbar             | standard Markdown                        | unsupported attrs rejected                       |
| code block                      | fenced code                              | `codeBlock.language`        | toolbar             | standard Markdown                        | unsupported attrs rejected                       |
| horizontal rule                 | `---`                                    | `horizontalRule`            | toolbar via kernel  | standard Markdown                        | unsupported attrs rejected                       |
| image                           | `![alt](attachments/file.png)`           | `image.src/alt/title`       | image add           | standard Markdown                        | non-attachment preview not loaded, still durable |
| text align                      | HTML style on `p` / `h*`                 | `textAlign` attr            | toolbar             | HTML-compatible Markdown                 | invalid alignment rejected                       |

## 小场景

1. Markdown-only edit: agent edits `segment.md` with heading/list/link/underline/highlight; read regenerates sidecar and UI projection.
2. Sidecar JSON-only edit: agent edits `content.tiptap.json` with heading/list/link/underline/colored highlight/sup/sub/alignment; passive reconcile writes Markdown and snapshot converges.
3. Audio transcript parity: same sidecar JSON-only matrix works for audio Segment transcript and audio SegmentSupplement transcript.
4. Renderer projection: Tiptap JSON with colored highlight, underline, link, sup/sub and alignment renders in open editor and keeps toolbar model usable.
5. Unsupported sidecar: table or non-finite attr enters needs-review; Markdown and sidecar are preserved.
6. Unsafe attrs: arbitrary highlight color or non-default link target does not become durable accepted content.
7. Cache invalidation: file truth event after sidecar rewrite invalidates selected Segment/Supplement content and refreshes UI.

## 验证边界

- Targeted main tests:
  - `tiptapMarkdownCodec.test.ts`
  - `tiptapContentSidecar.test.ts`
  - `workspaceFiles.test.ts` needs-review / passive reconcile slices
  - `recordingDrafts.test.ts` transcript sidecar slices
- Targeted renderer tests:
  - `LightweightMarkdownEditorSurface.test.tsx`
  - `LoadedWorkspaceFrame.test.tsx` or `App.test.tsx` file truth refresh projection slices
- 小步 E2E / runtime:
  - 不新建一个大而假的 E2E。
  - 优先脚本化或 focused integration：逐项断言文件变化、snapshot 收敛、UI 投影、needs-review report、doctor 输出、cache invalidation。
- 收口：
  - `npm run verify:quick`
