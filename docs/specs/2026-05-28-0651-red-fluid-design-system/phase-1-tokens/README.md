# Phase 1 · Tokens

- Timezone: America/Los_Angeles (PDT)
- Phase status: plan drafted, awaiting execution
- Parent spec: `../README.md`

## 目标

把 Reo 当前 token 系统从「黑色为主 Soft Flat」替换为 spec Section 1 + Section 6 定义的「品牌红 + Fluid 多层 surface」骨架。本 phase **零 TSX 改动**，纯 token 替换与命名标准化；现有所有组件通过 shadcn token 自动消费新颜色。

## 范围

仅以下 5 个文件可改：

| 文件 | 角色 | 变更类型 |
|---|---|---|
| `docs/current/design-system/tokens.json` | W3C-style 结构化 token 源 | 重写 |
| `docs/current/design-system/variables.css` | CSS custom property 源 | 重写 |
| `docs/current/design-system/DESIGN.md` | 设计系统叙述 | 更新核心定义 + 视觉语义 + 三条铁律 + 组件规则 |
| `src/renderer/src/theme.css` | runtime 主题投影 | 重写（@theme inline 暴露新 token；:root / [data-theme='dark'] 落 raw + semantic） |
| `src/renderer/src/index.css` | Tailwind 入口 + utility | 仅新增 `@utility bg-brand-gradient` |
| `docs/current/frontend.md` | 前端真源 | 单行修正（设计系统描述句） |

不动：任何 `.tsx`、任何业务组件、任何 IPC / preload / main process、任何测试。

## Success criteria

- `npm run verify:quick` 通过
- `npm run dev` 启动后，sidebar、Memory rail、Memory Studio、Settings 三处主屏在 light / dark / 跟随系统都能正常渲染，无 token 缺失报错
- 视觉上：所有原使用 `bg-primary` 的位置（保存按钮、Switch checked、状态点）变为品牌红 `#dc2626`；所有 `text-destructive` / `bg-destructive` 位置变为深红 `#b91c1c`；focus ring 也变红
- 现有所有功能行为零退化：录音、笔记、Memory CRUD、Settings、删除 undo 等全部可用
- token 命名 100% 落入 spec Section 6.7 reserved prefix 表

## 风险

低。纯 token 替换，shadcn 自动消费。最大风险面是 `--input` 颜色从 `#f4f4f5` → `#ebebed`（light）/ `#18181b` → `#1f1f23`（dark）的轻微变化——这是 spec 设计意图，验证时只需确认未引入对比度问题。

## 后置

执行完毕后 `/review` + `/simplify` 通过，才能进入 Phase 2 (MemoryIcon primitive)。
