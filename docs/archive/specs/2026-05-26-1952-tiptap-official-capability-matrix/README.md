# Tiptap 官方能力完整性盘点

Timezone: America/Los_Angeles

## 目标

系统确认 Reo 当前 Tiptap toolbar 能力、Markdown 表达、`content.tiptap.json` 表达、Reo read/write/roundtrip 支持状态，以及 Codex-class agent 和人类直接编辑文件时的推荐最短路径。

本 spec 不改变当前编辑器视觉和预览形态。当前编辑体验保持以 Tiptap Simple Editor 模板为基线；补齐只发生在 Reo 边界层：能力矩阵、测试断言、agent 技能说明、文件合同和必要的 codec/sidecar 缺口。

## 意图对齐

- 一般情况 agent 和人类只改普通文件即可完成任务，不需要理解 hash、manifest、sidecar 或 `.reo` 内部细节。
- 不限制 agent 能力；agent 可以编辑 Markdown，也可以在专家场景编辑 `content.tiptap.json` 或 `.reo` 管理文件。
- Reo 负责把合法文件改动静默收敛到 UI、sidecar、manifest mirror 和 index；无法确定的冲突进入 review/错误，不覆盖用户内容。
- 高级格式必须可被外部直接表达。尤其是高亮颜色、下划线、上下标、link、heading、list、code、blockquote 和 alignment，不能只存在于 toolbar 内部。
- 外部成熟系统按官方模型完整接入。Tiptap 的 editor、extension、Markdown extension 和 Simple Editor UI primitive 不做挑选式重写；Reo 只做本地文件真源、主题、布局、Electron 权限和产品入口的薄适配。

## 官方依据

- Tiptap 官方 Markdown extension 支持用 `contentType: 'markdown'` 把 Markdown 作为 editor 输入，并通过 `editor.getMarkdown()` 导出 Markdown。
- Tiptap 官方 `MarkdownManager` 支持 `editor.markdown.parse(markdown)` 解析为 Tiptap JSON，并支持 `editor.markdown.serialize(json)` 从 JSON 序列化回 Markdown。
- Tiptap 官方扩展范式是在 extension 上声明 `parseMarkdown`、`renderMarkdown` 和需要时的 `markdownTokenizer`，让非标准 Markdown/HTML 表达也进入同一 parse/serialize 管线。
- Highlight 官方支持 `Highlight.configure({ multicolor: true })`；默认高亮是 `<mark>`，多色由 extension attr 表达。
- TextAlign 官方按 node type 配置，例如 `TextAlign.configure({ types: ['heading', 'paragraph'] })`。
- Link、blockquote、codeBlock、list、heading、inline code、bold、italic、strike、underline、superscript 和 subscript 等基础能力来自 Tiptap/StarterKit 或对应官方 extension。

参考：

- https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/markdown/examples.mdx
- https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/markdown/getting-started/basic-usage.mdx
- https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/markdown/api/markdown-manager.mdx
- https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/markdown/guides/integrate-markdown-in-your-extension.mdx
- https://github.com/ueberdosis/tiptap-docs/blob/main/src/content/editor/extensions/marks/highlight.mdx

## 当前 Reo 模型

Reo 当前不是 Markdown 和 JSON 双真源。当前模型是：

- Markdown/frontmatter 是普通语义入口和默认文件真源。
- 同节点 `content.tiptap.json` 是同一正文的富结构载体和专家入口。
- Reo reconcile 是收敛 owner：Markdown 变更生成 JSON；JSON 变更序列化回 Markdown；两者同时变更且无法确定时保留双方并返回冲突。
- `.reo/objects/*.json` 是 manifest mirror 和技术完整性层，不是用户语义第二真源。
- 专家直接编辑 `content.tiptap.json` 时，普通规则是只修改 `content` 字段。`schemaVersion`、`objectType`、`source`、`profile`、`contentHash` 和 hash baseline 由 Reo reconcile 重算或校验，agent 不应为了普通富文本编辑维护这些技术字段。

## 状态机

```text
clean
  ├─ markdown_changed_only
  │    └─ parse Markdown with Tiptap Markdown profile
  │       └─ rewrite content.tiptap.json + baselines
  │          └─ clean
  ├─ tiptap_json_changed_only
  │    └─ validate supported Tiptap profile
  │       └─ serialize JSON with Tiptap Markdown profile
  │          └─ rewrite Markdown + sidecar baselines
  │             └─ clean
  ├─ markdown_and_json_changed
  │    └─ conflict / needs review, do not overwrite either side
  ├─ unsupported_tiptap_json
  │    └─ review surface, do not serialize lossy content
  └─ invalid_sidecar
       └─ review surface, do not rewrite Markdown
```

## 不变量

- Toolbar 能力不能被误读为 editor kernel 能力上限；文件/profile 可以支持比 toolbar 更完整的 Tiptap JSON。
- Markdown 推荐路径必须让人类能直接读写；只有 Markdown 无法简洁表达的富结构才推荐 HTML-compatible Markdown 或 `content.tiptap.json`。
- `content.tiptap.json` 只有在能无损序列化回 Reo Markdown profile 时才自动收敛。
- 彩色高亮只接受 Reo toolbar 暴露的 durable token：`var(--tt-color-highlight-green|blue|red|purple|yellow)`。
- 任意 CSS 颜色、未知 mark、未知 node、非有限 JSON attr、危险 link attr 和未来 extension 内容不得被静默写回 Markdown。
- Link 外部打开只允许用户触发的 `http:` / `https:` URL；文件编辑合同不能扩大 Electron 外链权限。
- 外部文件变化必须通过 file truth event、snapshot refresh、Memory detail/content Query invalidation 静默进入当前 UI，不要求用户点击横向片段流或刷新页面。
- E2E 不写一个大而假的全流程。每个小测试只验证一个关键转移、边界或副作用。

## 支持矩阵

本矩阵里的 Markdown 是 Reo Markdown profile：标准 Markdown/GFM 加上通过 Tiptap 官方 extension/tokenizer 范式接入的 HTML-compatible Markdown 和少量 profile 语法，不等同于纯 CommonMark。

`content.tiptap.json` 形态列只描述 sidecar 的 `content` 子树；真实 sidecar envelope 还包含 `schemaVersion`、`objectType`、`source`、`profile` 和 `contentHash`。

Undo/redo 和 image add 是当前 toolbar 控件，但不属于本次 rich-text Markdown support matrix。图片附件合同已在现有 note attachment 能力中单独维护。

| 能力        | Tiptap / toolbar                                             | Reo Markdown profile                                                                                                                     | `content.tiptap.json.content` 形态                                                                                                             | 当前支持状态                                                                            | 最短外部编辑路径                                              |
| ----------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 高亮        | `Highlight` + 高亮 popover                                   | 普通高亮：`==text==`                                                                                                                     | text mark `{ type: 'highlight' }`                                                                                                              | codec、sidecar、UI read、toolbar write 已覆盖                                           | 普通任务写 `==text==`                                         |
| 彩色高亮    | `Highlight.configure({ multicolor: true })` + 5 个 Reo token | `<mark data-color="var(--tt-color-highlight-blue)" style="background-color: var(--tt-color-highlight-blue); color: inherit">text</mark>` | text mark `{ type: 'highlight', attrs: { color: 'var(--tt-color-highlight-blue)' } }`                                                          | codec、sidecar、toolbar write、file truth live sync 已覆盖                              | Markdown HTML 最短；批量或精确结构可改 sidecar JSON `content` |
| 下划线      | toolbar underline mark                                       | `++text++`，HTML `<u>text</u>` 可读                                                                                                      | text mark `{ type: 'underline' }`                                                                                                              | codec、sidecar、toolbar write、file truth live sync 已覆盖                              | 普通任务写 `++text++`                                         |
| 上标        | toolbar superscript mark                                     | `<sup>text</sup>`                                                                                                                        | text mark `{ type: 'superscript' }`                                                                                                            | codec、sidecar、UI read、toolbar write 已覆盖                                           | 写 `<sup>text</sup>`                                          |
| 下标        | toolbar subscript mark                                       | `<sub>text</sub>`                                                                                                                        | text mark `{ type: 'subscript' }`                                                                                                              | codec、sidecar、UI read、toolbar write 已覆盖                                           | 写 `<sub>text</sub>`                                          |
| Link        | link popover                                                 | `[text](https://example.com)`；带 title 可用 Markdown title 或 HTML `<a>`                                                                | text mark `{ type: 'link', attrs: { href, title?, target: '_blank', rel: 'noopener noreferrer nofollow' } }`；非默认 `target/rel` 不自动持久化 | codec、外链边界和 link apply toolbar write 已覆盖；remove 走 Tiptap link selection 模型 | 普通任务写 Markdown link                                      |
| Heading     | heading dropdown 露出 H1-H4；profile 支持 H1-H6              | `#` 到 `######`；带 alignment 用 `<hN style="text-align: center">text</hN>`                                                              | node `{ type: 'heading', attrs: { level: 1..6, textAlign? } }`                                                                                 | codec 支持 H1-H6；toolbar H1-H4 写入已覆盖                                              | 普通任务写 Markdown heading；H5/H6 直接写文件                 |
| List        | list dropdown bullet/ordered/task                            | `- item`、`1. item`、`- [ ] task`、`- [x] task`                                                                                          | `bulletList` / `orderedList` / `taskList`，子级为 `listItem` / `taskItem`；ordered list 可带 `attrs.start`，task item 带 `attrs.checked`       | codec、sidecar 和 toolbar 写入已覆盖                                                    | 普通任务写 Markdown/GFM list                                  |
| Inline code | mark button                                                  | `` `code` ``                                                                                                                             | text mark `{ type: 'code' }`                                                                                                                   | codec、sidecar、toolbar write 已覆盖                                                    | 普通任务写 inline code                                        |
| Code block  | code block button                                            | fenced code block, e.g. ` ```ts `                                                                                                        | node `{ type: 'codeBlock', attrs: { language? } }`                                                                                             | codec、sidecar、UI read、toolbar write 已覆盖                                           | 普通任务写 fenced code                                        |
| Blockquote  | blockquote button                                            | `> text`                                                                                                                                 | node `{ type: 'blockquote', content: [{ type: 'paragraph', ... }] }`                                                                           | codec、sidecar、UI read、toolbar write 已覆盖                                           | 普通任务写 `> text`                                           |
| Alignment   | text align buttons left/center/right/justify                 | `<p style="text-align: center">text</p>` 或 `<hN style="text-align: right">text</hN>`                                                    | paragraph/heading attr `{ textAlign: 'left' }`、`center`、`right` 或 `justify`                                                                 | codec、sidecar、UI read、toolbar write 已覆盖                                           | Markdown HTML block 最短；精确批量可改 sidecar JSON `content` |

## 缺口判断

当前源码和测试显示：Reo 的 core codec、sidecar reconcile 和 editor kernel 已经覆盖大多数请求能力。首期缺口主要不是 editor 能力缺失，而是外部协作合同没有完整显式化，以及若干用户可见写入路径缺 focused 断言。

首期补齐结果：

- `src/main/workspaceFiles.ts` 中 workspace managed `reo-edit` 模板已补齐 rich text 最短路径矩阵；生成后的文件路径仍是记忆空间内 `skills/reo-edit/SKILL.md`。
- `LightweightMarkdownEditorSurface` toolbar 写入已用 focused tests 断言 heading、普通/彩色高亮、下划线、上下标、inline code、link apply、task list、blockquote、code block 和 alignment 的 Markdown/JSON 输出。
- sidecar JSON-to-Markdown focused matrix 已覆盖 link、heading/list/code/blockquote/alignment，不只依赖 codec durable matrix 间接证明。
- renderer/file truth focused test 已隔离 JSON-only 路径：Markdown fallback 保持普通文本时，外部 `content.tiptap.json` 修改为彩色高亮和下划线后，当前 selected content 经 `window.reoWorkspace.onFileTruthChanged`、snapshot refresh 和 selected content refetch 显示新正文和 mark。
- 简化审查已修正假覆盖、过窄调用次数断言、sidecar helper 重复写文件逻辑、生成模板中过于含糊的 fenced code 示例，以及 link popover 图标按钮的可访问名称。
- current 文档已包含本轮稳定能力索引；本 spec 只保留任务证据。

## 非目标

- 不改变当前编辑器视觉、toolbar 形态、预览样式或 Notes-like 编辑模型。
- 不引入第二套编辑器、第二套 Markdown parser 或 Reo 自研 rich text runtime。
- 不把 `.reo` manifest 当成用户普通编辑路径。
- 不扩大 Electron 权限、外链权限或 renderer Node 能力。
- 不为未来 extension 写 speculative abstraction；未来新增 extension 必须按同一官方 extension + Markdown profile + allowlist + roundtrip test + agent skill 规则接入。
