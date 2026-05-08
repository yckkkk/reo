# 工作区入口设计系统优化

创建时间：2026-05-07 21:04 America/Los_Angeles

## Objective

把工作区创建入口从临时“添加工作区”选择弹层改成符合 Reo 设计系统的 sidebar 项目入口和专用“创建本地工作区”弹层，并把本次涉及的按钮、输入框、菜单、表单字段行沉淀为可复用设计系统组件或 primitive variant。

## 成功标准

- Sidebar 显示项目区域、已知工作区和添加入口。
- Sidebar 的 Home 和项目列表项必须是已打通的命名导航入口；点击 Home 或当前工作区项目项时返回对应 Home surface，并关闭已打开的添加菜单。
- 添加入口菜单只有两个中文动作：新建空白项目、打开本地工作区。
- 点击新建空白项目后打开专用“创建本地工作区”弹层，不再打开“添加工作区”选择弹层。
- 打开本地工作区直接选择现有 Reo 工作区文件夹并走 `openWorkspace(selectionToken)`，不进行初始化。
- Home 主内容区不再显示独立 `+` 创建按钮，创建入口统一在 sidebar 项目区。
- 添加工作区菜单必须显示在主内容 panel 之上，不被 panel 遮挡。
- 添加工作区菜单左边缘必须和添加 icon button 左边缘对齐；添加 icon button 只在项目标题行 hover、focus-within 或菜单打开时显示。
- 每个交互组件必须有明确 accessible name，不能依赖按钮顺序或“按钮 1/按钮 2”。
- Sidebar 折叠/展开时主内容 panel 右边缘固定，panel 只向左展开或向右收起。
- AppShell 必须有 48px 无边框 titlebar shell slot，窗口控制属于 titlebar 层，视觉上不新增分隔线；sidebar hide/show control 必须使用设计系统 titlebar positioning token，左边缘对齐到原生 macOS traffic-light cluster 右侧，并垂直对齐原生 traffic-light 行，折叠切换前后不发生 slot 偏移；main panel 必须保留对应 48px panel titlebar slot，页面内容从该 slot 下方开始。
- 创建表单使用中文文案、紧凑字重字号、清晰字段优先级和不与文字重叠的分隔线。
- 创建表单包含工作区名称、描述、工作区位置；描述是可选字段并随 initialize payload 提交。
- 本次新增视觉规则必须先进入 token、primitive 或 reusable component，再由业务组件使用。
- Button、Input、字段行、菜单 surface 的 radius、typography、spacing、surface、border、focus、disabled state 均来自 Reo token。
- 变更允许通过设计系统影响其他现有页面样式。
- 当前 renderer 可见界面文案统一为中文；本 slice 触达的 Home、workspace entry、memory detail、recording drawer、playback、autosave/error feedback 不保留英文操作文案。
- 不新增 worktree。

## Open-source / official 评估

- Sidebar 和创建弹层保持 React + Tailwind + shadcn source-owned primitive；没有新增 routing 或 shell framework。
- 菜单是两个动作的轻量 app-shell popover，不需要新增 Radix Dropdown Menu dependency；若后续需要 roving focus、多层菜单或复杂键盘导航，再引入 Radix Dropdown Menu。
- 表单继续使用 React Hook Form + Zod。
- 按钮、输入框、label、separator 继续使用当前 shadcn source-owned primitives，并在 Reo token 上扩展 variant/size。

## 可复用性决策

- Button：调整全局 button radius、font weight 和尺寸层级，保留 `accentCircle` 作为显式圆形 icon-only accent control 例外。
- Input/Textarea：新增 compact/default 输入尺寸；Textarea 使用输入框 radius、compact UI typography 和 72px minimum height。
- Field：新增设计系统字段组/字段行 primitive，用于表单 label、hint、control、divider spacing。
- Menu：新增设计系统菜单 surface/item primitive，用于 sidebar 添加工作区菜单；菜单从 compact header action 打开时以 trigger 左边缘为锚点。
- Workspace entry 仍是 workspace feature consumer，不把业务状态抽成 generic runtime。

## 行为边界

- 本 slice 不创建跨 session workspace registry、recent projects store、DB table 或 Zustand store。
- Sidebar 已知工作区只展示当前 runtime session 和固定示例数据来源，不引入持久化。
- 打开本地工作区走现有 `openWorkspace(selectionToken)` 合约，仍只发送 selection token，不暴露 raw path。
- 新建空白项目的弹层表单沿用当前 initialize 合约，当前所选文件夹就是将被初始化的工作区文件夹。

## TDD 计划

1. RED：更新 AppShell 测试，要求中文 sidebar、项目列表真实导航、添加菜单、菜单动作、菜单 stacking、trigger-left anchoring、导航前关闭已打开菜单、项目标题行 hover/focus/open 显示添加 icon、interactive component accessible names、panel left-anchor 折叠动效、titlebar hide/show control token 定位和垂直居中，以及 titlebar shell slot、panel titlebar slot、Electron drag/no-drag region。
2. RED：更新 App 测试，要求 Home 不出现 `+` 创建按钮，sidebar 新建动作打开“创建本地工作区” dialog，打开本地工作区走 `openWorkspace`，sidebar 当前工作区项目项能从 detail 返回 Home，且不出现旧“添加工作区”选择弹层。
3. RED：更新 workspace create form 测试，要求中文字段、compact folder picker、submit-time validation、selection token 传输。
4. GREEN：更新 token、primitive、workspace entry 和 app shell。
5. REFACTOR：检查组件是否仍有一次性视觉常量，必要时上移到 primitive variant 或 token。

## 验证

- `npm run test:renderer -- src/renderer/src/components/ui/textarea.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx`
- `npm run test:renderer -- src/renderer/src/app-shell/AppShell.test.tsx`
- `npm test -- --run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx`
- `npm run verify:titlebar -- --image /tmp/reo-window.png`
- `npm run verify:quick`
