# Tasks — Note CodeMirror 6 Live Preview Initiative

只记录跨工作单元里程碑，不复制各 spec 执行清单。

## 收口硬门槛

每个里程碑收口前，执行代码任务的 AI 必须运行 subagent `/review` 与 `/ycksimplify`（`/simplify`）并处理发现，否则不得勾选完成。

## 里程碑

- [ ] M0 — CM6-ready style-nonce CSP 基线（Stage 0）
  - spec：`docs/specs/2026-05-20-2348-cm6-style-nonce-csp-baseline/`（active）
  - 完成标志：生产 CSP 带 per-load style nonce；合成样式注入验证（带 nonce 生效 / 不带 nonce 被拦截）；`docs/current/electron.md` 更新；`npm run build` + `npm start` runtime 证据归档。
- [ ] MA — 保存模型 + 编辑面设计决策（Stage A，gated on 待决问题）
  - 完成标志：Obsidian 式保存模型、studio 内联编辑、stage FAB 展开、共享 CM6 编辑器实例、外部修改/冲突简化方案落为 `docs/decisions/0007-*` 增补；据此重排并细化 Stage 1 spec。
- [ ] M1 — CM6 底座 + 新保存模型（Stage 1）
  - 完成标志：`@codemirror/*` 安装；textarea→CM6；现有 create/edit/finalize/冲突/paste-drop 行为测试全绿；生产 CSP 下 CM 样式生效。
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
