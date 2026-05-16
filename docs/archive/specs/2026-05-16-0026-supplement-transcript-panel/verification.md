# 补充录音转录区 — 验证

实现前先留空；实现完成后填入命令输出、视觉证据与决定性快照。

## 命令验证

- [x] `npm run typecheck`：Task 8 Step 1 `npm run verify:quick` 覆盖，通过。
- [x] `npm run test:main`：Task 8 Step 1 `npm run verify:quick` 覆盖，550 tests 通过。
- [x] `npm run test:renderer`：Task 8 Step 1 与 content tab More 菜单稳定性修复后 `npm run verify:quick` 覆盖，35 files / 342 tests 通过。
- [x] `npm run lint`：Task 8 Step 1 `npm run verify:quick` 覆盖，通过。
- [x] `npm run format:check`：Task 8 Step 1 `npm run verify:quick` 覆盖，通过。
- [x] `npm run verify:quick`：Task 8 Step 1 通过；输出摘要见 `artifacts/verify-quick.txt`。

## 视觉证据（dev server）

- [x] supplement panel empty 态：`这段补充录音还没有转录。`，见 `artifacts/supplement-empty.jpg`。
- [x] supplement panel exists 态：有 transcript 文本，`max-w-[820px]`、`select-text` 生效，见 `artifacts/supplement-exists.jpg`。
- [x] supplement panel 长 transcript：滚动复用 panel 既有 `overflow-y-auto` surface，未在内部再加滚动条，见 `artifacts/supplement-long.jpg`。
- [x] supplement panel loading 态：`正在载入补充录音内容。`，见 `artifacts/supplement-loading.jpg`。
- [x] supplement panel error 态：`补充录音转录加载失败，请重试。`，与 audio 行下方 `补充录音加载失败。` 同时可见且互不冲突，见 `artifacts/supplement-error.jpg`。
- [x] Segment transcript tab 行为不变（loading / error / exists / empty 文案一致，几何不变），见 `artifacts/segment-transcript-tab.jpg`。
- [x] content tab rail 宽度反馈：runtime DOM 临时注入长 supplement title 后 hover 验证，button/label 最大宽度 `130px`，supplement pill 外层最大宽度 `170px`，More glyph `20px` 且完全在 pill 内；见 `artifacts/content-tab-width-hover.png` 与 `artifacts/content-tab-width-hover-metrics.json`。
- [x] content tab rail More 菜单稳定性反馈：hover supplement tab 后打开 More menu，再把鼠标移入 dropdown；More trigger 保持 `data-state="open"` 展开态，More 与 menu 的 `left/width` 变化均为 `0px`，避免 anchor 收缩导致菜单左右抖动；见 `artifacts/content-tab-menu-open-stability.png` 与 `artifacts/content-tab-menu-open-stability-metrics.json`。

截图与命令输出存入 `artifacts/`。
