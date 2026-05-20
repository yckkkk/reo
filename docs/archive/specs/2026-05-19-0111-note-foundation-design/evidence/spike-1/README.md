# Spike 1: BlockNote adapter evaluation

- 时间：2026-05-19 America/Los_Angeles
- 沙盒：`.tmp/note-foundation-spikes/spike-1-blocknote/`
- 结论状态：DONE_WITH_CONCERNS

## 推荐

推荐 Reo sub-spec (b) 采用 `@blocknote/mantine` 作为第一版 BlockNote adapter，不采用 `@blocknote/shadcn`。

理由：

- `@blocknote/mantine@0.51.1` 在 React 19 + Vite + Tailwind CSS v4 沙盒内可直接 mount。
- 官方 React 路径仍是 `useCreateBlockNote` + `BlockNoteView`，Markdown import/export 路径可用：`editor.tryParseMarkdownToBlocks(markdown)` 与 `editor.blocksToMarkdownLossy(blocks)`。
- Markdown export 明确是 lossy，符合当前 spec 的判断：BlockNote JSON 不能成为 Reo 语义真源，必须继续以 Markdown/frontmatter 为真源，并保留 subset gate / raw mode / round-trip gate。
- Mantine adapter 提供完整默认 UI integration，当前类型支持 Mantine `theme` 扩展；bare `BlockNoteViewRaw` 在当前版本类型中只接受 `"light" | "dark"`，Reo retokenization 需要更多 CSS 覆盖或自定义 component mapping。
- `@blocknote/shadcn` 未安装，且不是本 spike 依赖路径。
- Radix Dialog/DropdownMenu/Popover/Tooltip portal probe 在同页运行正常；BlockNote 自身 portal 默认挂在 editor container 内，且可通过 `portalElements` 指向 `document.body` 或 selector，没有发现与 Reo shadcn/Radix portal 的硬冲突。

## 拒绝 bare `BlockNoteViewRaw + custom CSS` 作为首选

bare 方案可以 mount，也能导入和导出 Markdown，但不适合作为第一版默认：

- `BlockNoteViewRaw` 当前 theme prop 只接受 `"light" | "dark"`，不能直接传完整 Reo token theme object。
- 若要做到 Reo 设计系统一致，需要维护更深的 CSS override 或 components context，风险高于 Mantine adapter 的 retokenization。
- bare 方案的收益主要是少一个 Mantine adapter layer；但 `@blocknote/react` 仍然带默认 UI、Floating UI、Tiptap/ProseMirror 等主体成本，体积收益不够抵消 UI 维护成本。

保留 bare 方案作为 fallback：如果 Mantine adapter 后续在 Electron runtime 中出现不可接受的 CSS、focus、portal 或 bundle 问题，再切换到 bare view + Reo-owned CSS/component mapping。

## Milkdown fallback

不触发 Milkdown fallback。

原因：BlockNote current 版本已在沙盒中完成 mount、Markdown parse、lossy Markdown export、Tailwind v4 build、Radix portal coexistence 和截图采集。剩余风险属于 adapter retokenization、bundle budget 和 lossy Markdown gate，不是 BlockNote 不可用。

## 已运行命令

在 repo root：

```bash
mkdir -p .tmp/note-foundation-spikes/spike-1-blocknote docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-1
```

在 `.tmp/note-foundation-spikes/spike-1-blocknote/`：

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install @tailwindcss/vite tailwindcss @blocknote/core @blocknote/react @blocknote/mantine @mantine/core @mantine/hooks @mantine/utils @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-popover lucide-react
npm run build
npm install -D playwright
npm run lint
npm run dev -- --host 127.0.0.1 --port 5179
playwright screenshot --channel chrome --viewport-size 1440,1000 --wait-for-selector '[data-adapter="mantine"] .bn-editor' --wait-for-timeout 1500 http://127.0.0.1:5179/ /Users/yck/Downloads/PM/技术线/reo/docs/specs/2026-05-19-0111-note-foundation-design/evidence/spike-1/blocknote-spike.png
```

另外用 Playwright + system Chrome 采集了 DOM/CSS/portal runtime evidence。

## exact installed package versions

沙盒 `npm ls --depth=0` 中相关版本：

```text
@blocknote/core@0.51.1
@blocknote/react@0.51.1
@blocknote/mantine@0.51.1
@mantine/core@9.2.1
@mantine/hooks@9.2.1
@mantine/utils@6.0.22
@radix-ui/react-dialog@1.1.15
@radix-ui/react-dropdown-menu@2.1.16
@radix-ui/react-popover@1.1.15
@radix-ui/react-tooltip@1.2.8
@tailwindcss/vite@4.3.0
tailwindcss@4.3.0
react@19.2.6
react-dom@19.2.6
vite@8.0.13
typescript@6.0.3
playwright@1.60.0
```

`npm ls @blocknote/shadcn --depth=0` 输出为空。

## Tailwind CSS v4 integration

沙盒使用 `@tailwindcss/vite`，并在 `src/index.css` 使用：

```css
@import 'tailwindcss';
@source "../node_modules/@blocknote/react";
@source "../node_modules/@blocknote/mantine";
@source "../node_modules/@mantine/core";
```

Vite build 通过，说明 Tailwind v4 `@source` 可显式纳入 third-party package path。BlockNote/Mantine 的主样式仍主要来自 package CSS，不应期待 Tailwind 自动 retokenize 第三方 CSS。

## Radix Portal conflict risk

当前判断：没有发现硬冲突，风险为低到中。

证据：

- Radix DropdownMenu portal 打开后在 `document.body` 下产生 `data-radix-popper-content-wrapper`，菜单文本正常。
- Radix Dialog portal 打开后 `.dialog-overlay` 和 `.dialog-content` 在 body 下存在，`role=dialog` 文本正常，z-index 为 40/50。
- BlockNote source 显示默认 portal root 是 `editor.portalElement`，默认挂在 `.bn-container` 内；`portalElements` 支持 selector 或 `null`，其中 `null` 显式指向 `document.body`。
- `@blocknote/mantine` source 多处对 Mantine internal popover/menu/tooltip 使用 `withinPortal={false}`，降低与外部 Radix portal 竞争的概率。

剩余风险：

- Reo 的 real AppShell、Drawer/Vaul、Toast、DropdownMenu 和 future NoteEditorOverlay 必须在 Electron runtime 中再验证 focus trap、z-index、ESC、pointer-events 和 theme inheritance。
- BlockNote floating UI 的 z-index 使用 `--bn-ui-base-z-index`，需要在 Reo editor surface 上设置明确 token，避免与 Dialog/Drawer/Toast 混层。

## CSS/Tailwind retokenization remaining

采用 Mantine adapter 后仍需做：

- 引入 BlockNote CSS 和 Inter 字体的策略要与 Reo 字体/体积预算对齐，必要时不要导入 BlockNote bundled Inter。
- 用 Mantine theme 或 wrapper CSS 把 editor/menu/tooltip/hover/selected/border/radius 映射到 Reo semantic tokens。
- 审查并移除或覆盖同平面 border、默认 shadow、过强 hover、非 Reo radius。
- 设置 `--bn-ui-base-z-index`，并明确 NoteEditorOverlay、Radix Dialog/Dropdown/Tooltip/Toast 的层级顺序。
- 对 read-only `MarkdownContentSurface` 关闭不需要的 editor UI，避免只读 surface 出现编辑 affordance。

## Build result

`npm run build` 成功，但有两类 concern：

- Vite/CSS optimizer 报 BlockNote Mantine CSS 内部 `@import` ordering warning。
- 主 JS chunk 为 1,255.22 kB, gzip 376.41 kB；Vite 提示 chunk 超过 500 kB。Reo 实施时应懒加载 Note editor surface，而不是放入初始 renderer bundle。

`npm run lint` 成功。
