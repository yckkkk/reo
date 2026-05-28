# Phase 1 · Implementation Notes

执行过程证据按时间顺序记录。每完成一个 Task 在此追加一节。

格式参考：

```
## Task N · <名称>
- 时间：2026-05-28 HH:MM PDT
- 改动：<文件清单>
- 验证：<执行的命令 + 结果摘要>
- 备注：<任何偏离 plan 的决定、风险记录>
```

## Task 1 · 重写 tokens.json

- 时间：2026-05-28 07:20 PDT
- 改动：`docs/current/design-system/tokens.json`（完整重写）
- 验证：JSON 结构有效（写入后 file 大小 ~5.4 KB，所有 brand/surface/gradient/shadow/radius/font section 都存在；color 与 dark 两套保持平行结构）
- 备注：tokens.json 是设计系统数据源；下游 variables.css 与 theme.css 必须与此严格对齐。`color-mix`、`var()` 表达式作为 token 值是允许的（W3C Design Tokens 规范不限制 value 语法）
- Commit: `4766208d feat(design-system): rewrite tokens.json for red fluid system`

## Task 2 · 重写 variables.css

- 时间：2026-05-28 07:25 PDT
- 改动：`docs/current/design-system/variables.css`（完整重写）
- 验证：与 tokens.json 逐项对齐——`:root/[data-theme='light']` 段含 Layer 1 raw + Layer 2 semantic + Layer 3 radius + Layer 4 effect；`[data-theme='dark']` 段含同样的 Layer 1 raw + Layer 2 semantic + Layer 4 effect（radius 继承自 :root）。所有新增 token 名落入 spec Section 6.7 reserved prefix
- 备注：variables.css 不被 runtime build 直接引用，是 design-system 源文件镜像；runtime 真源是 theme.css（Task 4 处理）
- Commit: `fe3ef439 feat(design-system): rewrite variables.css mirror for red fluid system`

## Task 3 · 更新 DESIGN.md

- 时间：2026-05-28 07:28 PDT
- 改动：`docs/current/design-system/DESIGN.md`（完整重写）
- 验证：重新读取后确认：标题改为 "Reo Red Fluid Design System"；核心定义不再描述黑色为主 Soft Flat；视觉语义新增 surface-1..4、primary-hover、brand-gradient 表述；Hero 表面表格与 spec Section 4.1 / 4.2 一致；命名规范关键约束指向 spec README#section-6
- 备注：narrative 文档，runtime 不消费；只服务 agent 阅读
- Commit: `a36227fa docs(design-system): describe red fluid system + token naming convention reference`

## Task 4 · 重写 theme.css runtime

- 时间：2026-05-28 07:32 PDT
- 改动：`src/renderer/src/theme.css`（完整重写）
- 验证：
  - `@theme inline` 块新增暴露：`--color-primary-hover`、`--color-brand-{red,magenta,ember}`、`--color-surface-{1,2,3,4}`、`--radius-3xl`、`--radius-4xl`、`--shadow-hero-{lift,fill,inset,edge}`、`--shadow-surface-inset`
  - `@theme inline` 中所有 shadow 改为 `var(--shadow-X)` 引用（**这是行为变化**：旧实现的 `@theme inline` 用 literal value，Tailwind 生成静态 utility，dark mode 下 `[data-theme='dark']` 的 shadow 覆盖不生效；新实现让 utility 解析为 `var()`，dark 切换生效）
  - `:root/[data-theme='light']` 段完整复制自 Task 2 variables.css，确保 runtime 与 design-system 源逐字一致
  - `[data-theme='dark']` 段同样完整复制
- 备注：**主动声明的行为变化**：shadow utility 现在 dark mode 下会切换值；旧实现是 latent bug（不切换）。本次顺手修正与命名规范是同一架构改动的一部分
- Commit: `17162b3a feat(theme): replace runtime tokens with red fluid system`

## Task 5 · bg-brand-gradient utility（Task 8 已回滚）

- 时间：2026-05-28 07:34 PDT
- 改动：初始 commit 曾在 `src/renderer/src/index.css` 暴露 `@utility bg-brand-gradient`；Task 8 review 后已移除
- 验证：Task 8 新增 `renderer Tailwind entry does not source-scan docs or expose ownerless gradient utilities`，断言 `src/renderer/src/index.css` 不含 `@utility bg-brand-gradient`
- 备注：Phase 1 只保留 `--brand-gradient` raw token；gradient utility 延后到真实 owner primitive 接入时再落
- Commit: `d884428e feat(theme): expose bg-brand-gradient Tailwind utility`

## Task 6 · 修正 frontend.md 设计系统描述

- 时间：2026-05-28 07:36 PDT
- 改动：`docs/current/frontend.md` 第 11 行附近的设计系统描述句
- 验证：修订后该行准确描述 Red Fluid System，引用所有新 token（brand-red/magenta/ember/gradient、surface-1..4、destructive #b91c1c、shadow-float/modal），并指针 DESIGN.md 作为完整规范来源
- 备注：frontend.md 其余段落（Hero 表面映射、组件清单等）涉及 Phase 2-5 的 TSX 改动，留到 Phase 6 文档收口阶段统一更新（写当前事实时实现已落地）
- Commit: `c42b2017 docs(frontend): update design system tagline to red fluid system`（描述句改动单独 commit；本 notes 追加另开 commit）

## Task 7 · verify:quick + 视觉 smoke

- 时间：2026-05-28 07:43 PDT
- 改动：
  - `src/renderer/src/theme.css`：`:root/[data-theme='light']` 段补回 `--radius` ~ `--radius-full`（含新增 `--radius-3xl` 与 `--radius-4xl`），与原始模式一致（@theme inline + :root 双写）。原始 plan 漏了这点
  - 新建 `docs/current/design-system/theme.css` 文件镜像（实际是已存在但 plan 漏改）：完整复制新版 src/theme.css 内容
  - 重写 `test/main/designSystemTokens.test.ts`：把 token contract 从旧 Soft Flat 切到新 Red Fluid（含 brand-red/magenta/ember raw 层、surface-1..4、primary-hover、destructive #b91c1c、新 hero shadow、新 radius-3xl/4xl、brand-gradient 断言）；保留 brand-blue/brand-spectrum/brand-red-hover/brand-grad 负向断言以挡退役名
  - prettier --write 修复 5 个文件格式（src/theme.css、test、DESIGN.md、design-system/theme.css、design-system/variables.css）：多行 shadow 被合并为单行，表格列宽对齐
- 验证：
  - `npm run verify:quick` 第二次运行 exit code 0；532 tests 全过；lint 无 warning；format:check pass（只 spec 文档剩 prettier warning，下一 commit 处理）
  - **plan 缺口暴露与修补**：原 plan 没包含 `docs/current/design-system/theme.css` 镜像更新与 token contract 测试同步——这两个缺口让 verify:quick 第一次失败。本次以"修补 + 记录"方式收口，未来 phase 应在 plan 阶段就盘点所有镜像与契约测试
- 备注：Task 8 已补充浏览器 runtime 视觉证据；本节原始 "视觉 smoke 留待用户复核" 不再是当前缺口

## Task 8 · review + simplify gate

- 时间：2026-05-28 08:24 PDT
- 改动：
  - `src/renderer/src/index.css`：移除无 current TSX consumer 的 `bg-brand-gradient` utility；按 Tailwind v4 `@source not` 官方模型排除 `docs` source scanning，避免 spec prose 生成 runtime CSS
  - `src/renderer/src/components/ui/button.tsx` + `button.test.tsx`：Button primary hover 改用 `hover:bg-primary-hover`，给 `primary-hover` semantic token 一个真实 primitive consumer
  - `docs/current/design-system/tokens.json`：`brand-gradient` 值复用 `--brand-*` raw token，不重复硬编码品牌色
  - `test/main/designSystemTokens.test.ts`：扩展为规则化 token contract，覆盖 `variables.css` / `theme.css` mirror、gradient、radius、shadow、命名规则和 Tailwind entry source 边界
  - `docs/current/*` 与 phase spec：同步 Phase 1 实际范围、Button hover、Tailwind source scanning、Red Fluid 命名和 review gate 状态
  - `artifacts/task8-runtime-memory-studio-rich-*-cdp.png` + `task8-runtime-memory-studio-rich-cdp.json`：记录 light / dark Memory Studio rich runtime 证据
- 验证：
  - Context7 查询 Tailwind CSS 当前文档，确认 v4 CSS-first 可在 `@import 'tailwindcss'` 后使用 `@source not "<path>"` 排除扫描路径
  - `/review` + `/simplify` 子任务指出：docs 误扫、ownerless gradient utility、Button hover token 无 consumer、current docs future truth、token test 覆盖不足；以上均已修正
  - RED：`npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/components/ui/button.test.tsx` 先因 Button 仍输出 `hover:bg-primary/90` 失败
  - GREEN：同一 renderer targeted test 通过，1 file / 7 tests
  - `MAIN_TEST_FILES=test/main/designSystemTokens.test.ts npm run test:main` 通过，6 tests
  - `npm run build:app` 通过；产物 CSS scan 确认没有 `.bg-brand-gradient` 或 `.shadow-hero-*` class selector，且 `.hover\\:bg-primary-hover:hover` 已生成
  - Chrome extension/browser-client 通道返回 unavailable；插件诊断显示 Chrome、Codex Chrome Extension 与 native host 均安装启用，因此 runtime smoke 改用临时 headless Chrome CDP 会话，不触碰用户现有 profile
  - `task8-runtime-memory-studio-rich-cdp.json` assertions 全 true：light/dark 均加载 Memory Studio rich，primary/ring 分别为 `#18181b` / `#fafafa`，Settings 语音页 Switch checked 分别为 `#18181b` / `#fafafa`，destructive 保持 `#b91c1c`，有 canvas waveform，无 runtime exception；Memory Studio light/dark 与 Settings light/dark 四张 screenshot 均为 1440x1000
- 备注：Task 8 的简化结论是"token 可先落 raw asset，但 runtime utility 必须有 current consumer 或明确 owner phase"；Phase 2 之前不再补无 consumer utility。用户指出 Settings 层级红色 Switch 不符合设计心智后，Phase 1 将 `primary/ring` 从品牌红纠正为中性黑白；品牌红只保留在 brand / recording / Hero raw 资产与 destructive 之外的明确 owner 内
