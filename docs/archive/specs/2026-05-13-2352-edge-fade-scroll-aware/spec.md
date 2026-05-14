# edge-fade 滚动感知

spec 时间：2026-05-13 23:52 America/Los_Angeles

## 根因

`src/renderer/src/index.css` 的 `edge-fade-y` / `edge-fade-x` 是静态 CSS `mask-image`，
无条件对元素两端边缘应用渐隐，完全不感知滚动位置。结果：转录文本第一行一加载就被
顶部遮罩压暗，违背「该遮罩是『上方还有内容被滚走』的滚动信号」这一设计意图。

模型错误：把「滚动信号」实现成了「永久装饰层」。同根因还体现在 `edge-fade-x`：
`MemoryStudio` 已算出 `canScrollLeft / canScrollRight`，却没接到 mask 上。

## 目标

edge fade 的强度由滚动位置驱动：

- 顶/左端 fade 仅在该方向有内容被滚走时出现（`scrollStart > 0`）。
- 底/右端 fade 仅在该方向仍有内容未露出时出现（未滚到末端）。
- 内容不溢出时完全无 fade。

## 方案

让「滚动感知」成为工具类自身的能力，三个复用点零改动：

- `@property` 注册 `--edge-fade-top/bottom/left/right` 为 `<length>`，`initial-value: 0px`，
  使其可在 keyframe 中插值。
- 4 个 `@keyframes` 分别把对应变量从 0↔size 插值。
- `edge-fade-y`/`edge-fade-x` 的 mask gradient 改用这些变量作为停靠点。
- 用 CSS scroll-driven animation 驱动：`animation-timeline: scroll(self block|inline)` +
  两段 `animation-range`（首段 / 末段）+ `animation-fill-mode: both`。
- 内容不溢出时该轴无滚动条，scroll timeline 失效，变量保持 `initial-value: 0px` → 无 fade。

零 JS、零 hook，复用点不需改动。Chromium 原生支持 scroll-driven animation，Electron 满足。

官方依据：MDN `animation-timeline: scroll()`、`animation-range`、`@property`
（Context7 MCP 本会话不可用，按 CLAUDE.md 回退到官方站点核对语法）。

## 成功标准

- 转录面板未滚动时，第一行顶部完整清晰、无遮罩。
- 向下滚动后，顶部 fade 淡入；滚到底后底部 fade 淡出。
- 横向片段条同理（左右端）。
- 内容不溢出时无任何 fade。
- `npm run verify:quick` 通过；既有断言 `edge-fade-*` 类名的测试仍通过。

## TDD 豁免

纯 CSS mask + scroll-driven animation 行为依赖真实布局与滚动，jsdom 无法验证。
既有单测仅断言类名存在，已覆盖。按 CLAUDE.md，设计变更收口以运行时视觉验证为准。

## 验证证据

- `npm run verify:quick` 全绿（2026-05-13 23:54 PDT）：typecheck 通过，
  test:main 335 passed，test:renderer 257 passed，lint 通过，format:check 通过。
- 运行时视觉验证：改动经 Vite HMR 注入正在运行的 dev 实例，由用户在转录面板确认
  —— 未滚动时首行无遮罩、下滚后顶部 fade 淡入、滚到底底部 fade 淡出；横向片段条同理。
