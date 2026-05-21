# Tasks — Note CodeMirror 6 Live Preview Initiative

只记录跨工作单元里程碑，不复制各 spec 执行清单。

## 收口硬门槛

每个里程碑收口前，执行代码任务的 AI 必须运行 subagent `/review` 与 `/ycksimplify`（`/simplify`）并处理发现，否则不得勾选完成。

## 里程碑

- [ ] M0 — CM6-ready style-nonce CSP 基线（Stage 0）
  - spec：`docs/specs/2026-05-20-2348-cm6-style-nonce-csp-baseline/`（active）
  - 完成标志：生产 CSP 带 per-load style nonce；合成样式注入验证（带 nonce 生效 / 不带 nonce 被拦截）；`docs/current/electron.md` 更新；`npm run build` + `npm start` runtime 证据归档。
- [x] MA — 保存模型 + 编辑面设计决策（Stage A）
  - **决策已锁定**于 `docs/decisions/0007` Stage A 节（2026-05-21）：Obsidian 式自动保存、studio 内联编辑、点击文本区展开 Markdown 格式工具栏、三入口同一 CM6 实例、visibilitychange 重载。Stage 1 spec 的细化在 Stage 0 收口后进行（遵守一次一个 active spec）。
- [ ] M1 — CM6 底座 + Obsidian 式保存（Stage 1）
  - 完成标志：`@codemirror/*` 安装（仅此阶段）；textarea→CM6；**Obsidian 式自动保存**（新建即建 segment.md、防抖 auto-write、无保存按钮、**删除** note draft/finalize 与冲突弹窗；旧保存/冲突测试删除或重写为新行为）；studio 内联编辑 + Markdown 格式工具栏 + 三入口同一 CM6 实例；paste/drop 附件；visibilitychange 重载；新增 renderer 测试已登记 `vitest.config.ts` `include` 且 `npm run test:renderer` 实际执行；真机生产 CSP 下真实 CM6 样式生效（截图/DevTools 证据）；`electron.md`/`flow.md`/`frontend.md` 更新。详见 initiative plan 的「Stage 1 spec 必须显式落定」清单。
- [ ] M2 — Live Preview decorations（Stage 2）
  - 完成标志：active block raw + 其它 block 预览（标题/列表/引用/代码块/链接），Reo token，IME 不被打断，大文档可见区渲染，运行时视觉证据。
- [ ] M3 — 图片 widget + 共享映射（Stage 3）
  - 完成标志：图片 `reo-attachment://` 预览 widget；active 行回落 raw；附件 src 映射 helper 共享；body markdown 真源不变。
- [ ] M4 —（可选）只读态统一（Stage 4）

## 当前进行中

- M0（spec 已建，待下一 session 执行代码）。

## 下一 session 入口

1. 读 `docs/specs/2026-05-20-2348-cm6-style-nonce-csp-baseline/`（README + plan + implementation-notes）。
2. 按 plan 的代码任务拆解执行 Stage 0（真实 TDD + 运行时证据）。
3. 收口后把长期事实压回 `docs/current/electron.md`，证据移 `docs/archive/specs/*`，更新本文件 M0 勾选并把 M1 设为进行中。
