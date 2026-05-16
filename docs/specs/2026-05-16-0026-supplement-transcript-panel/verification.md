# 补充录音转录区 — 验证

实现前先留空；实现完成后填入命令输出、视觉证据与决定性快照。

## 命令验证

- [x] `npm run typecheck`：Task 8 Step 1 `npm run verify:quick` 覆盖，通过。
- [x] `npm run test:main`：Task 8 Step 1 `npm run verify:quick` 覆盖，550 tests 通过。
- [x] `npm run test:renderer`：Task 8 Step 1 `npm run verify:quick` 覆盖，35 files / 338 tests 通过。
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

截图与命令输出存入 `artifacts/`。
