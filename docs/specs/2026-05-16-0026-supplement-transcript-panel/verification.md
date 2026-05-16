# 补充录音转录区 — 验证

实现前先留空；实现完成后填入命令输出、视觉证据与决定性快照。

## 命令验证

- [ ] `npm run typecheck`
- [ ] `npm run test:main`
- [ ] `npm run test:renderer`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run verify:quick`

## 视觉证据（dev server）

- [ ] supplement panel empty 态：`这段补充录音还没有转录。`
- [ ] supplement panel exists 态：有 transcript 文本，`max-w-[820px]`、`select-text` 生效。
- [ ] supplement panel 长 transcript：滚动复用 panel 既有 `overflow-y-auto` surface，未在内部再加滚动条。
- [ ] supplement panel loading 态：`正在载入补充录音内容。`
- [ ] supplement panel error 态：`补充录音转录加载失败，请重试。`，与 audio 行下方 `补充录音加载失败。` 同时可见且互不冲突。
- [ ] Segment transcript tab 行为不变（loading / error / exists / empty 文案一致，几何不变）。

截图与命令输出存入 `artifacts/`。
