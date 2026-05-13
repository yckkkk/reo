# 三态外观偏好与持久化

开始时间：2026-05-13 07:05 America/Los_Angeles

关联长期任务：无。

## 目标

把 App shell 的外观切换扩展为 `浅色 / 深色 / 跟随系统` 三态偏好，并把用户偏好跨会话持久化。`跟随系统` 由 `prefers-color-scheme` 解析为生效主题，OS 偏好变化时实时同步。

## PRD

### 问题

当前外观切换只有浅色/深色二态，缺少 `跟随系统`；偏好保存在内存 state，每次启动 dev 都回到浅色，无法跨会话保留用户选择。

### 用户故事

1. 作为用户，我希望除浅色和深色外还能选择 `跟随系统`，让 Reo 与 OS 外观保持一致。
2. 作为用户，我希望主题选择在下次启动后仍然保留，不用每次手动切换。
3. 作为用户，我希望 `跟随系统` 状态下，在 OS 切换深浅色时 Reo 同步切换，无需重启。

### 成功标准

- 用户偏好域是 `'light' | 'dark' | 'system'`；生效主题域是 `'light' | 'dark'`，由偏好与 `(prefers-color-scheme: dark)` 派生。
- 偏好通过 `localStorage` key `reo.themePreference.v1` 持久化；首次启动或键缺失/损坏时默认 `'system'`。
- 生效主题写入 App shell `data-theme` 与 `document.documentElement` `data-theme`；Sonner toast 同步用生效主题。
- 侧边栏底部使用单按钮循环 `浅色 → 深色 → 跟随系统 → 浅色`；按钮图标随当前偏好变化为 Sun / Moon / MonitorSmartphone；aria-label 与 tooltip 表达下一动作。
- `跟随系统` 状态下订阅 `matchMedia('(prefers-color-scheme: dark)')` 的 change 事件，OS 偏好变化即时反映到生效主题。
- `docs/current/frontend.md` 同步当前真源。
- `npm run verify:quick` 通过。

### 非目标

- 不引入 Electron `nativeTheme` 同步：renderer 通过 `matchMedia` 即可解析 OS 偏好，main 当前没有原生 chrome 表面需要主题。
- 不引入新的 store、provider 或 Zustand：偏好只在 `App` 顶层 state + localStorage。
- 不引入 DropdownMenu 三选项：保留单按钮循环，零结构成本。
- 不扩展 Sonner theme 到 `'system'`：在 App 层已解析生效主题，传给 Sonner 的是确定 `'light' | 'dark'`，避免双重 system 解析路径。

## 工程设计

### 抽象

`src/renderer/src/app-shell/themePreference.ts` 是主题域真源：

- `ThemePreference = 'light' | 'dark' | 'system'`：用户偏好。
- `ThemeMode = 'light' | 'dark'`：生效主题。
- `THEME_PREFERENCE_STORAGE_KEY`：`reo.themePreference.v1`。
- `SYSTEM_DARK_MEDIA_QUERY`：`(prefers-color-scheme: dark)`。
- `readThemePreference()`：从 `localStorage` 读取并校验，未知值与读失败回落 `'system'`。
- `writeThemePreference(pref)`：best-effort 写入；写失败不影响内存偏好。
- `resolveEffectiveTheme(pref, isSystemDark)`：`'system'` 时按 `isSystemDark` 派生，否则直返。
- `cycleThemePreference(current)`：固定循环 `light → dark → system → light`。

### 状态归属

- `App` 持有 `themePreference` 与 `isSystemDark` 两个 state；`effectiveTheme` 由 `resolveEffectiveTheme` 派生。
- `App` 在 mount 时通过 `readThemePreference()` 初始化偏好；通过 `matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches` 初始化 `isSystemDark`。
- `App` 订阅 `matchMedia(SYSTEM_DARK_MEDIA_QUERY)` 的 `change` 事件，在 unmount 时移除。
- 偏好每次变更立即写回 `localStorage`，保持内存与持久化一致。
- `AppShell` 不订阅 `matchMedia`，只消费 `themePreference` 与 `effectiveTheme`，并通过 `onCycleThemePreference` 上报循环动作。

### 视觉与可达性

- 按钮在侧边栏底部沿用现有 `ghostIcon` Button + Tooltip primitive，零新增 UI 组件。
- 三个图标来自 `lucide-react`：`Sun` / `Moon` / `MonitorSmartphone`。
- aria-label 与 Tooltip content 表达下一动作（`切换到深色模式` / `切换到跟随系统` / `切换到浅色模式`），保持与原有"切换到 X"风格一致。
- `data-theme` 写到 App shell root 与 document 根节点，保证 Radix portal 浮层继承当前生效主题。

### 官方依据

- MDN `Window.matchMedia` 与 `MediaQueryList` change 事件文档：renderer 直接订阅 `(prefers-color-scheme: dark)` 即可在 Chromium 中实时跟随 OS 偏好。
- MDN `Window.localStorage`：同步 KV API，足够承载单个偏好键；以 try/catch 包裹兼容 storage 不可用情况。
- Sonner `Toaster` 文档：`theme` 接受 `'light' | 'dark' | 'system'`；这里传入已解析的 `'light' | 'dark'` 避免双重 system 解析路径。
- Radix Tooltip 文档：Tooltip Trigger 必须可聚焦；沿用现有 `ghostIcon` Button + TooltipTrigger 组合。

### 测试计划

- `themePreference.test.ts`：`readThemePreference` 默认 `'system'`、未知值回落、三种已知值读写一致；`writeThemePreference` 持久化；`resolveEffectiveTheme` 显式偏好与 `'system'` + isSystemDark 派生；`cycleThemePreference` 固定循环。
- `AppShell.test.tsx`：完整三态循环（光/深/系统/光）与 `data-theme` 反映；`'system'` + isSystemDark=true 渲染生效 dark。
- `App.test.tsx`：默认偏好 `'system'`、`matchMedia` 解析生效主题、localStorage 未写入；持久化跨 remount + 完整循环写入 `reo.themePreference.v1`。
- 既有"loaded workspace state"集成测试 seed `THEME_PREFERENCE_STORAGE_KEY = 'light'`，保留原有 data-theme 断言。

## 验证记录

- `npx vitest run src/renderer/src/app-shell/themePreference.test.ts` 通过：7 个单测覆盖读/写/解析/循环。
- `npx vitest run src/renderer/src/app-shell/AppShell.test.tsx` RED 后 GREEN：新增三态循环与 `'system'` + OS-dark 派生两个测试，旧 toggle 测试被替换。
- `npx vitest run src/renderer/src/App.test.tsx -t "theme"` 通过：默认 `'system'` + matchMedia 派生 dark；跨 remount 持久化 + 完整循环写入 localStorage。
- `npx vitest run src/renderer` 通过：27 文件 / 257 测试。
- `npm run verify:quick` 通过：typecheck、test:main、test:renderer 257、lint、format:check。
