# Phase 1 · Tokens

- Timezone: America/Los_Angeles (PDT)
- Phase status: Complete
- Parent spec: `../README.md`

## 目标

把 Reo 当前 token 系统从「黑色为主 Soft Flat」替换为 parent spec Section 1 + Section 6 定义的「品牌红表达入口 + 黑白中性控件语义 + Fluid 多层 surface」骨架。初始计划为纯 token 替换；Task 8 review 后追加最小 Button primitive hover token 接入、Tailwind source scanning 约束，并把 `primary/ring` 从品牌红纠正为中性控件语义。

## 范围

本 phase 当前实际范围：

| 文件                                                                                        | 角色                      | 变更类型                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `docs/current/design-system/tokens.json`                                                    | W3C-style 结构化 token 源 | 重写，gradient 值复用 brand token，primary/ring 使用中性控件语义                   |
| `docs/current/design-system/variables.css`                                                  | CSS custom property 源    | 重写                                                                               |
| `docs/current/design-system/theme.css`                                                      | 设计系统 theme mirror     | 同步 runtime theme                                                                 |
| `docs/current/design-system/DESIGN.md`                                                      | 设计系统叙述              | 更新当前视觉规则与命名规则                                                         |
| `docs/current/design-system/README.md`                                                      | 设计系统目录入口          | 同步 Red Fluid 命名                                                                |
| `docs/current/frontend.md`                                                                  | 前端真源                  | 同步设计系统与 Button hover 当前事实                                               |
| `docs/current/product.md`                                                                   | 产品美学真源              | 同步 Red Fluid 当前事实                                                            |
| `src/renderer/src/theme.css`                                                                | runtime 主题投影          | 重写（@theme inline 暴露新 token；:root / [data-theme='dark'] 落 raw + semantic）  |
| `src/renderer/src/index.css`                                                                | Tailwind 入口             | 排除 `docs` source scanning；保持现有 utility 集；未落无 consumer gradient utility |
| `src/renderer/src/components/ui/button.tsx`                                                 | Button primitive          | primary hover 改用 `hover:bg-primary-hover`                                        |
| `test/main/designSystemTokens.test.ts`                                                      | token contract 测试       | 同步 Red Fluid token、neutral primary/ring、mirror、gradient 与命名规则            |
| `src/renderer/src/components/ui/button.test.tsx`                                            | Button 行为测试           | 覆盖 `primary-hover` consumer                                                      |
| `docs/specs/2026-05-28-0651-red-fluid-design-system/phase-1-tokens/implementation-notes.md` | 执行证据                  | 记录 Task 1-8 与 neutral primary 纠偏                                              |

不动：IPC / preload / main process、业务 feature flow、runtime behavior。

## Success criteria

- `npm run verify:quick` 通过
- `npm run dev` 启动后，sidebar、Memory rail、Memory Studio、Settings 三处主屏在 light / dark / 跟随系统都能正常渲染，无 token 缺失报错
- 视觉上：所有普通 `bg-primary` 位置（保存按钮、Switch checked、状态点）在 light 下为近黑、dark 下为近白；focus ring 跟随中性 `primary`；品牌红只保留在 brand / recording / Hero raw 资产与明确 owner 内；所有 `text-destructive` / `bg-destructive` 位置变为深红 `#b91c1c`
- 现有所有功能行为零退化：录音、笔记、Memory CRUD、Settings、删除 undo 等全部可用
- token 命名 100% 落入 parent spec Section 6.7 reserved prefix 表；无 current consumer 的 utility 不进入 runtime CSS

## 风险

低到中。主体是 token 替换，shadcn 自动消费；Task 8 追加了最小 Button primitive hover token consumer、Tailwind source scanning 约束和 neutral primary 纠偏。最大视觉风险面是普通 primary 控件从品牌红回到中性黑白后，必须确认 brand red 没有继续泄漏到 Settings 这类配置层控件，同时表达入口仍保留 `bg-brand-ember`。

## 后置

Phase 1 已通过 `/review` + `/simplify` gate；下一步进入 Phase 2 (MemoryIcon primitive) plan。
