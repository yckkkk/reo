# Implementation Notes — FAB SpeedDial Hero 化

## 决策日志

### 接入写法：全内联 Tailwind arbitrary，不新增 `@utility`

- shadow 必须走 Tailwind `!shadow-[...]`（设置 `--tw-shadow`），否则裸 `box-shadow`
  会被 `focus-visible:!ring-2` 的 `!important` box-shadow 覆盖，focus 时 Hero 光感消失。
- 构建产物已验证 box-shadow 合成栈：
  `box-shadow: var(--tw-inset-shadow), …, var(--tw-ring-shadow), var(--tw-shadow) !important`，
  Hero 光感（`--tw-shadow`）与 focus ring（`--tw-ring-shadow`）共存。

### 测试断言：锁耐久 token 类，不锁视觉微值

- FAB trigger 单测断言 `!shadow-[var(--shadow-hero-fill),var(--shadow-hero-edge)]`（只引用耐久 token 名）
  作为「is hero」信号，并断言不再有 `!bg-brand-ember`。

### 浅色亮度运行时校准（用户反馈 → C）

- 初版浅/深 `--brand-gradient` 几乎相同（深色仅混 8% 黑），浅色满饱和压白底显重偏深。
- harness 横向对比 4 个浅色方案，用户选 **C 提亮色相**：`#ff6a33 → #ef4444 → #e879f9`，
  比当前亮、保留火的鲜艳、浅亮深沉拉开差距。深色保持当前不动。

### 颜色必须走 token（用户纠正 → 停靠 token 模型）

- 不把色值写进渐变。新增 Layer-1 raw 停靠 token `--brand-gradient-{from,via,to}`：
  - 浅色 = C 的提亮色相（hex 只存在于 raw token 定义，是 raw 层合法归属）
  - 深色 = `color-mix(in oklab, var(--brand-*) 92%, var(--surface-1))`，字面量 `#09090b` 也换成 `var(--surface-1)`
  - `--brand-gradient` 两个主题同值，只引用停靠 token；浅/深差异落在停靠 token 上
- 同步 4 处定义：`src/renderer/src/theme.css`、design-system `theme.css` / `variables.css` / `tokens.json`。

### specular：去掉内联 radial，由 token 承担

- 初版组件 bg 叠了内联白色 `rgb(255 255 255 / 0.3)` radial specular——组件最后一处写死色值。
- 运行时对比：去掉 radial 后，`--shadow-hero-edge` token 的顶部高光已提供等效 specular，视觉几乎无损。
- 据此去掉内联 radial：组件 bg = 纯 `!bg-[image:var(--brand-gradient)]`，组件零写死色值，更克制。

### 设计系统 token 守卫测试同步

- `test/main/designSystemTokens.test.ts`：`gradientContract` 改为引用停靠 token；
  浅/深 color contract 补 `brand-gradient-{from,via,to}`（强制 3 个 CSS 文件同步）；
  差异化断言从「渐变值不同」改为「停靠 token 不同」+「渐变不含原始色」。守卫意图（CSS 变量、非原始色、浅≠深）保留。

## 进度

- [x] spec 建立（README / implementation-notes）
- [x] 组件改动（trigger → `--brand-gradient` + hero-fill + hero-edge + hover brightness）
- [x] 测试断言更新（FAB 单测 + designSystemTokens 守卫）
- [x] token 化浅色 C + 停靠 token 模型 + DESIGN.md 当前真源表 / Layer-1 清单 / 描述更新
- [x] 去掉内联 specular（组件零写死色值）
- [x] verify:quick 全绿（typecheck:quick / test:main 928 / test:renderer 542 / lint:strict / format:check）
- [x] 运行时浅/深色视觉验证（C 提亮、深色不变、token-only orb）
- [x] /review + /simplify（phase-gate）：无确认 bug、无需应用清理

## phase-gate 结论

- /simplify：代码已干净。抽 `@utility reo-hero-fill-edge` 与加 `--brand-gradient-dark-mix-base`
  均为「待第 2 个 Hero consumer 才有意义」的提前抽象，按项目规则 defer；`ease-out` 是 DESIGN.md 约定缓动，保留。
- /code-review：无确认 bug。`doesNotMatch(lightGradient, /color-mix/)` 查的是只含 `var()` 的 `--brand-gradient`
  值（非停靠 token），不会在深色失败（test:main 全绿佐证）；白图标压在红色中停对比 ≈3.4:1 > 非文本 3:1，无回归。

## 运行时视觉证据

- 浅色 token(C) orb：提亮橙红→亮品红火渐变 + hero-edge 顶部高光 + hero-fill 红色 glow，白色 `+` 图标。
- 深色 orb：深火渐变 + 红色 glow halo，与初版一致（未改动）。
- 去掉内联 radial specular 后与带 specular 版几乎无差别，确认 hero-edge token 承担顶部高光。

## 验证记录

- `npm run build:app`：renderer CSS 生成，确认停靠 token 解析、bg/shadow class 合成正确。
- `npm run verify:quick`：typecheck:quick + test:main(928 pass) + test:renderer(542 pass) + lint:strict + format:check 全绿。
