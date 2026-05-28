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
