# Red Fluid Design System

- Timezone: America/Los_Angeles (PDT)
- Started: 2026-05-28 06:51 PDT
- Status: design contract locked, awaiting Phase 1 plan via `superpowers:writing-plans`

## 目标

把 Reo 的设计系统从「黑色为主的 Soft Flat」演化为「**品牌红主导** + **Fluid Functionalism 多层 surface 骨架** + **保留扁平阅读层**」的统一系统。

- **品牌红**承载 Reo 的"录音/记录"语义，作为 primary、ring、主 CTA 的色相载体。
- **Fluid 多层 surface** 在容器层提供 5 级 elevation（surface-1..5），在表达入口层（FAB、RecordingOverlay、MemoryIcon、Segment 渐变卡）提供 Hero 表面。
- **扁平阅读层**：Input、Textarea、Tab、List row、Toolbar pill、Dropdown item、Tiptap 编辑器表面保持 Soft Flat，不上 gradient / 不上玻璃，保护文本可读与编辑专注。
- 严格保护 Electron renderer 性能：不使用 `backdrop-filter`、不使用 SVG `<filter>`、不使用 WebGL；所有 Hero 效果走 CSS gradient + inset shadow，目标新增 paint cost < 2ms/frame at 1440p。

设计的成功标准是**融洽**，不是"最少视觉元素"。干净由排版与信息层级承担。

## 不变量（本次任务范围之外的事，不动）

- Memory 数据模型与 schema：hue 完全在 renderer 派生，不进 metadata 文件、不进 DB
- `LightweightMarkdownEditorSurface`（Tiptap）视觉不重写
- Sidebar 与 AppShell titlebar 不上品牌 chrome
- Settings shell 不动
- DropdownMenu / Tooltip / Breadcrumb / Switch / Field / Separator / Waveform primitive 不重写 TSX（只走 token）
- Zustand 不引入
- RecordingOverlay 现有行为不变：live ASR、节流 recovery snapshot、PCM tail 压缩、pause/scrub/resume、completion backfill、recovery marker flush 全部保留
- 不引入新的 build/runtime dependency
- 不动 Figma 文件结构；Figma 同步是手动后置工作，不在本 spec 内执行

## Section 1 · Token 系统骨架

### 1.1 颜色 token

**Layer 1 · raw 品牌资产**

| token | light | dark | 用途 |
|---|---|---|---|
| `--brand-red` | `#dc2626` | `#dc2626` | 品牌主红，primary 的色源 |
| `--brand-magenta` | `#d946ef` | `#d946ef` | brand-gradient 冷尾 |
| `--brand-ember` | `#ff4704` | `#ff4704` | brand-gradient 暖头 + FAB action 实色（既有品牌名，保留作为命名例外） |
| `--brand-gradient` | `linear-gradient(135deg, var(--brand-ember) 0%, var(--brand-red) 50%, var(--brand-magenta) 100%)` | dark 下饱和 -8% | Hero 表达入口的"火"渐变 |

**Layer 2 · semantic 角色（动作与状态）**

| token | light | dark | 用途 |
|---|---|---|---|
| `--primary` | `var(--brand-red)` | `var(--brand-red)` | 主动作（替换原黑色 `#18181b`） |
| `--primary-foreground` | `#ffffff` | `#ffffff` | 主动作文字 |
| `--primary-hover` | `color-mix(in oklab, var(--primary) 90%, var(--foreground))` | 同 | primary hover |
| `--ring` | `var(--brand-red)` | `var(--brand-red)` | focus ring |
| `--destructive` | `#b91c1c` | `#b91c1c` | 危险动作（比 primary 暗一级，靠位置与上下文区分） |
| `--destructive-hover` | `color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground))` | 同 | 危险动作 hover |
| `--destructive-foreground` | `#ffffff` | `#ffffff` | 危险动作文字 |

### 1.2 Surface token（4 级 elevation 阶梯）

| token | light | dark | 现有语义映射 |
|---|---|---|---|
| `--surface-1` | `#ffffff` | `#09090b` | `--background` |
| `--surface-2` | `#f4f4f5`（+ `inset 0 1px 0 rgba(0 0 0 / .02)`） | `#18181b`（+ `inset 0 1px 0 rgba(255 255 255 / .04)`） | `--card` |
| `--surface-3` | `#ebebed` | `#1f1f23` | `--input`、强选中态 |
| `--surface-4` | `#ffffff` | `#27272a` | `--popover`（DropdownMenu / Tooltip / Toast / Dialog / AlertDialog / Drawer——浮层 bg 不分级，靠 shadow 区分 float 与 modal） |

Hero 与 surface 系统**正交**——它挂在表达入口与身份载体上，不参与 elevation 阶梯，因此不存在 `--surface-5`。

### 1.3 Radius scale

| token | value | 用途 |
|---|---|---|
| `radius-sm` | 8px | 32px icon button |
| `radius-md` | 12px | compact 文本 button |
| `radius-lg` | 16px | text button、card 默认形态（保留） |
| `radius-xl` | 20px | Input、Textarea（比目前更圆润） |
| `radius-2xl` | 24px | Dialog、Drawer、Hero 容器 |
| `radius-3xl` | 28px | MemoryIcon 96px、Hero card |
| `radius-4xl` | 32px | RecordingOverlay 全屏 hero card |
| `radius-full` | 9999px | FAB、圆点、Segment overlay arrow |

MemoryIcon 与 Segment gradient card 使用 `corner-shape: squircle`（已有 `reo-segment-card-squircle` utility）。

### 1.4 Shadow stack

| token | light | dark | 用途 |
|---|---|---|---|
| `--shadow-float` | `0 12px 32px rgb(0 0 0 / .08)` | `0 12px 32px rgb(0 0 0 / .4)` | DropdownMenu / Tooltip / Toast |
| `--shadow-modal` | `0 24px 64px rgb(0 0 0 / .12)` | `0 24px 64px rgb(0 0 0 / .6)` | Dialog / Drawer |
| `--shadow-hero-lift` | `0 24px 48px rgb(220 38 38 / .12), 0 1px 0 rgb(255 255 255 / .6) inset` | red tint .22，white inset .06 | Hero card 抬升（MemoryIcon 周身 drop） |
| `--shadow-hero-fill` | `0 12px 24px rgb(220 38 38 / .18), 0 0 0 1px rgb(255 255 255 / .14) inset` | red tint .28 | brand-gradient 充饱（FAB trigger、录音 CTA） |
| `--shadow-hero-inset` | `inset 0 1px 0 rgb(255 255 255 / .35), inset 0 -8px 16px rgb(0 0 0 / .12)` | white inset .25，dark inset .18 | MemoryIcon 顶高光 + 底渐隐 |
| `--shadow-hero-edge` | `inset 0 0 0 1px rgb(255 255 255 / .08), inset 0 1px 0 rgb(255 255 255 / .4)` | white .05/.2 | Hero 玻璃边（trigger、recording CTA） |

### 1.5 Hash-Hue helper（新增 `lib/memory-hue.ts`）

确定性 hash → OKLCH 三色组（base/warm/cool），用于 MemoryIcon、MemoryRailCard 选中态 tint、Segment 选中态 tint。Helper 返回的字段名与 Layer 5 runtime CSS 变量一一对应（见 Section 6.6）。

```ts
type MemoryHue = {
  base: string     // oklch(0.62 0.22 hue)        → 注入 --memory-hue-base
  warm: string     // oklch(0.74 0.20 hue - 28)   → 注入 --memory-hue-warm
  cool: string     // oklch(0.52 0.18 hue + 36)   → 注入 --memory-hue-cool
  gradient: string // linear-gradient(135deg, warm, base, cool) → 注入 --memory-hue-gradient
}

useMemoryHue(seed?: string): MemoryHue
```

- 空 seed 返回 `BRAND_HUE`（从 `--brand-gradient` 派生），永不落任意红。
- hash 落入 `[345°, 30°]` 红窗口时**强制 +90°**，保证 Memory 永不撞品牌红。
- 决定性：同 seed 必返回相同 hue。
- 选用 OKLCH 是因为 hue 间亮度感知一致。

### 1.6 Motion

- 常规交互：`duration-150 ease-out`（不变）
- 结构动效上限：`duration-200 ease-out`（不变）
- Hero hover specular blur 过渡：`duration-200 ease-out`
- 录音 CTA pulse ring：每 2s 一次，`transform: scale(1) → scale(1.4)` + `opacity: .3 → 0`，4s 内单次循环
- `prefers-reduced-motion: reduce` 下全部静止
- aurora mask 永远静止（不动）

## Section 2 · Surface 层级 + 组件映射

### 2.1 当前组件到新 surface 的映射

| 当前组件 | 当前 surface | 新映射 | 改 TSX? |
|---|---|---|---|
| `AppShell` page、`WorkspaceFrame` 主内容 | `bg-background` | `surface-1` | 否（token） |
| `AppShell` sidebar | `bg-card` | `surface-2` | 否 |
| `MemoryRailCard` 常态 | `bg-card` / hover `bg-secondary` | `surface-2` / hover `surface-3`（仍灰阶） | 否 |
| `MemoryRailCard` 选中 | `bg-secondary` | `surface-2 + Memory hue tint 12%` | **是**（接 `useMemoryHue`） |
| `MemoryStudioSegmentCard` 常态 | `bg-card` | `surface-2` | 否 |
| `MemoryStudioSegmentCard` 选中 | `bg-secondary` | `surface-3 + parent Memory hue tint 18%`（含 ±12° hue 偏移） | **是** |
| `Button` primary | `bg-primary` 黑 | `bg-primary` 红 #dc2626 | 否（token） |
| `Button` secondary | `bg-card` | `surface-2` / hover `surface-3` | 否（token） |
| `Button` destructive | `bg-destructive` #dc2626 | `bg-destructive` #b91c1c | 否（token） |
| `Input` / `Textarea` | `bg-input` | `surface-3` + `radius-xl` 20px | 否（token） |
| `DropdownMenu` / `Tooltip` / Sonner Toast | `bg-popover` + `shadow-float` | `surface-4`（highlight 保灰阶） | 否 |
| `Dialog` / `AlertDialog` / `Drawer` | `bg-popover` + `shadow-modal` | `--surface-4` + `--shadow-modal` + `--radius-2xl` 24px | 否（token） |
| **`FAB SpeedDial` trigger** | `bg-brand-ember` 实色 | **HERO**：`--brand-gradient` + `--shadow-hero-fill` + `--shadow-hero-edge` + 静态 specular | **是** |
| **`FAB SpeedDial` action** | `bg-brand-ember` 实色 | 纯 `--brand-ember` 实色（不上 gradient / 不画 specular / 不上 edge） | **是**（保持族群感，但不抢 trigger） |
| **`RecordingOverlay`** surface | full-window | `--surface-1` + 顶部 30vh aurora mask（linear-gradient `--brand-red` → `--brand-magenta`，alpha .08→0，静态） | **是** |
| **`RecordingOverlay`** 主 CTA | `bg-brand-ember` | **HERO** 72px round + pulse ring（录音中） | **是** |
| **`RecordingOverlay`** 次级 action | — | 40px round `--surface-3` icon-only（无 hero） | **是** |
| **`Waveform`** 色 token | `foreground` / `muted-foreground` | 录音中 `--brand-red`；播放进度 `--brand-gradient`；静态保持灰阶 | **是**（接 prop 选用） |
| **`MemoryIcon`** primitive（新） | — | HERO，纯 CSS 渲染，hue 由 seed 派生（Section 3） | **新建** |

### 2.2 关键约束（不可让步）

1. **Hero 不进入文本编辑表面**：Input、Textarea、LightweightMarkdownEditorSurface、SegmentTranscriptView 永远是 surface-3/surface-4，绝不渐变化、不上玻璃。
2. **Hash hue 只着色**：只控制 MemoryIcon、MemoryRailCard 选中态轻量 tint、Segment 选中态轻量 tint。不改文本色、不改 focus ring。chrome 指 AppShell titlebar、Sidebar 背景、ExpressionDock、Settings nav rail——这些层永远品牌红 / 灰阶，不接受 Memory hue。
3. **Zero Border 保留**：新 surface 之间靠 inset highlight + tint 落差区分，不画 1px 描边。
4. **dark mode 不掉队**：所有 Hero token 必须有 dark 版本，且对比度满足 WCAG AA 文本可读。
5. **Reduced motion**：所有 Hero 上的 hover blur 过渡、pulse ring、aurora drift（如未来引入）全部停止；只有静态形态保留。

## Section 3 · MemoryIcon Primitive

### 3.1 文件契约

- `src/renderer/src/lib/memory-hue.ts` — `useMemoryHue` helper + hash 算法 + red-window skip
- `src/renderer/src/components/ui/memory-icon.tsx` — `MemoryIcon` primitive

每个文件承担自己的业务责任，不混入对方关心的事。

### 3.2 API

```ts
type MemoryIconSize = 24 | 32 | 40 | 64 | 96 | 128

interface MemoryIconProps {
  seed?: string                // Memory.title 或 Memory.id；空时降级为 BRAND_HUE（从 --brand-gradient 派生）
  size?: MemoryIconSize        // default 40
  motion?: 'auto' | 'static'   // default 'auto'
  className?: string
  label?: string               // 非装饰场景必填；纯装饰时不传不读屏
}
```

不暴露 hue prop：hue 只从 seed 派生，避免业务层瞎填色破坏统一性。

### 3.3 视觉结构（4 层叠加，纯 CSS）

| 层 | 实现 | 备注 |
|---|---|---|
| Layer 1 · base substrate | `var(--surface-2)`（light）/ `var(--surface-3)`（dark），`corner-shape: squircle` | 无浮雕、无伪 3D |
| Layer 2 · diagonal grad fill | `conic-gradient(from 200deg, var(--memory-hue-warm) 0%, var(--memory-hue-base) 50%, var(--memory-hue-cool) 100%)` tilt 135° | hue 三色由 `useMemoryHue(seed)` 在 MemoryIcon 根节点注入 |
| Layer 3 · inner-glow ring | `inset 0 0 0 1px rgba(255 255 255 / .35)` | 玻璃边 |
| Layer 4 · specular highlight | `::after` radial-gradient top-left | hover 时 blur 4 → 1，`motion='auto'` |
| outer | `--shadow-hero-inset` + `--shadow-hero-lift` | 顶高光 + red-tinted drop |

24 / 32 size 使用降级 specular（单层静态 radial，opacity .35，无 blur 过渡）；光感的 DNA 在每个尺寸都保留。

### 3.4 尺寸与 radius

| size | radius | shadow | specular | consumer |
|---|---|---|---|---|
| 24 | `--radius-sm` 8 | `--shadow-hero-inset` 弱版 | 静态 radial 12% | DropdownMenu / Sidebar inline（未来） |
| 32 | `--radius-md` 12 | `--shadow-hero-inset` 弱版 | 静态 radial 14% | Breadcrumb prefix（未来） |
| 40 | `--radius-md` 12 | `--shadow-hero-inset` + `--shadow-hero-lift` 小版 | 4-layer，hover blur 4→1 | MemoryRailCard |
| 64 | `--radius-xl` 20 | `--shadow-hero-inset` + `--shadow-hero-lift` | 4-layer | Memory Studio titlebar |
| 96 | `--radius-3xl` 28 | `--shadow-hero-inset` + `--shadow-hero-lift` + `--shadow-hero-fill` | 4-layer | WorkspaceStarterHome grid（未来） |
| 128 | `--radius-4xl` 32 | 全套（+ `--shadow-hero-edge`） | 4-layer | RecordingOverlay 进场过场（未来） |

本 spec 真正接入 consumer 仅 40px（MemoryRailCard）与 64px（Memory Studio titlebar）；其他尺寸 primitive 已建好但不强制接入。

### 3.5 性能保障

- 不用 `backdrop-filter`
- 不用 SVG `<filter>`
- 单 DOM node + 1 `::before` + 1 `::after`
- 96px paint 目标 < 1ms/frame

### 3.6 测试边界

- 单元：`useMemoryHue` 同种子相等 / red-skip 边界 / 空 seed 降级
- 视觉：`?reoScenario=memory-icon` dev 场景挂载 6 个尺寸 × 4 个 seed 的检查面
- 不写"DOM 结构存在 4 层"这类锁实现的测试

## Section 4 · Hero 表面重塑

### 4.1 FloatingActionButtonSpeedDial

trigger 接入 HERO 全套：`background: var(--brand-gradient)` + `--shadow-hero-fill` + `--shadow-hero-edge` + 静态 specular。
- hover：fill 不变（避免渐变 hover 闪烁），shadow base radius +25%，specular opacity .35 → .50（150ms ease-out）
- active：`transform: scale(.96)`，shadow base 同步收缩，150ms
- reduced-motion：hover 不变 specular，active 保留 scale

action items：纯 `var(--brand-ember)` 实色，全圆，不画 specular、不上 edge。trigger 是 hero singular；action 是同语言子动作，不参与 hero 比较，保护 trigger 稀缺感。

### 4.2 RecordingOverlay

按业务解耦为多个独立文件（详见 Section 5 文件解耦纪律），不内联到单一大组件：

| 文件 | 职责 |
|---|---|
| `RecordingAuroraOverlay.tsx` | 顶部 30vh aurora mask，静态 linear-gradient，独立挂载、独立测试 |
| `RecordingHeroCta.tsx` | 72px round 主 CTA，`--brand-gradient` fill + `--shadow-hero-fill` + `--shadow-hero-edge`，承担"录音/暂停/继续"语义切换 |
| `RecordingPulseRing.tsx` | 录音中每 2s 一次 ring 扩散，独立 keyframe，reduced-motion 下不挂载 |
| `RecordingWaveformSurface.tsx` | waveform canvas 容器 + 录音色 token 接入；canvas mechanics 仍来自现有 `Waveform` primitive |
| `RecordingTranscriptArea.tsx` | 转写文本区域，保持 surface-1 / edge-fade-y / scrollbar-hover，已存在则提取，未存在则新建 |
| `RecordingOverlay.tsx` | 编排上述子组件 + 现有 recording machine、lifecycle、IPC、recovery snapshot，不写视觉细节 |

aurora alpha 上限 `.08`，永不延伸到转写区；waveform 与转写之间始终 24px 垂直间距。

性能：aurora = 单 div 静态 grad；pulse = 单 `::before` keyframe transform/opacity GPU 合成；waveform 沿用现有 canvas 路径只换色 token。整体新增 paint < 2ms/frame at 1440p。

## Section 5 · 迁移阶段 + 文件解耦纪律

### 5.1 阶段总览

| Phase | 范围 | 风险 | TDD? |
|---|---|---|---|
| **1 · Tokens** | 改 `theme.css`、`variables.css`、`tokens.json`、`design-system/DESIGN.md`：新 surface-1..5、新 hero shadow、新 radius、replace primary/destructive/ring。零 TSX 改动 | 低 | 否 |
| **2 · MemoryIcon primitive** | 新建 `lib/memory-hue.ts` + `components/ui/memory-icon.tsx`。无 consumer wire-up；提供 `?reoScenario=memory-icon` dev 场景 | 低 | **是** —— `useMemoryHue` 是公开 helper，覆盖确定性、red-skip、空 seed |
| **3 · Memory hue 接入** | 接入 MemoryRailCard、MemoryStudioSegmentCard、Memory Studio titlebar。Segment 继承 parent hue。Sidebar Memory item 暂不接 24px MemoryIcon（保留到后续 spec） | 中 | 否（视觉验证 + 场景） |
| **4 · FAB Hero reskin** | 重写 `floating-action-button-speed-dial.tsx`：trigger 全套 hero；action 纯 ember | 中 | 否 |
| **5 · RecordingOverlay Hero reskin** | 按 Section 4.2 解耦为 6 个文件；现有所有行为（live ASR、recovery、PCM tail、pause/scrub/resume、finalize、reduced-motion 关 pulse）不退化 | **高** | E2E focused tests：pulse 不阻断转写滚动、reduced-motion 下不渲染 pulse、录音中 aurora 不动 |
| **6 · 文档收口** | 更新 `docs/current/frontend.md` 加 surface-1..5 / MemoryIcon / Hero 三处映射；更新 `design-system/DESIGN.md`；归档本 spec | 低 | 否 |

每 phase 完成后过 `/review` + `/simplify` 再进下一相位。每 phase 子目录有自己的 `implementation-notes.md` 记录执行证据。

### 5.2 文件解耦纪律（适用于 Phase 4 / 5 的所有新增文件）

每个新文件承担**一个业务关切**，不内联多个职责：
- 视觉/行为独立的 sub-surface 各自一个文件
- helper / hook / machine / adapter 即使只服务一个 consumer 也单独一个文件
- 复用 primitive 留在 `components/ui/`；feature-local 子组件留在对应业务目录
- 新增目录满足 owner / IO 边界 / 测试位置 / current 文档落点四项明确

### 5.3 各阶段可独立 ship 边界

- Phase 1 单独 ship：app 全红、功能零退化；最小可见"红色 Reo"步骤
- Phase 2 单独 ship：用户不可见（primitive 未挂载），可放心合并
- Phase 3 单独 ship：Memory 有 hue identity；FAB 仍旧 ember
- Phase 4 单独 ship：FAB 升级为 hero
- Phase 5 单独 ship：录音体验完整升级
- Phase 6：文档同步，不阻塞 1-5

## Section 6 · Token 命名规范

设计系统的可读性依赖一致的命名。本规范覆盖 `theme.css`、`variables.css`、`tokens.json`、`design-system/DESIGN.md`、Figma Variables，以及任何 runtime 注入的 CSS custom property。

### 6.1 总原则

1. 全部使用 kebab-case：`--brand-red`、`--surface-1`、`--shadow-hero-lift`。
2. 双层分层：**raw 资产**（值的调色板）→ **semantic 角色**（UI 中的语义）。业务 TSX 只消费 semantic 层，raw 层只在 semantic 层与设计系统源文件内被引用。
3. 一个 token 一个用途：同一 token 不得同时承载 raw 值和 semantic 角色；如需桥接，写 `--primary: var(--brand-red)`，而不是让 `--brand-red` 同时充当 primary。
4. 不引入未使用的 token。无当前消费者的 raw 资产或 semantic 角色不进入设计系统。

### 6.2 Layer 1 · Raw 资产

| 模式 | 示例 | 规则 |
|---|---|---|
| `--brand-<colorname>` | `--brand-red`、`--brand-magenta`、`--brand-ember` | 颜色名而不是隐喻（红色不是火焰）。例外：`--brand-ember` 已是 Reo 既有品牌身份名，保留这一个例外并在 DESIGN.md 显式记录 |
| `--brand-gradient` | `--brand-gradient` | 渐变 raw 资产用完整词 `gradient`，不缩写为 `grad` |
| `--surface-N` | `--surface-1`..`--surface-4` | 数字单调递增 = elevation 递增；surface-1 为页面底，surface-4 为浮层顶 |

raw 层**不带状态后缀**：`--brand-red-hover` 是错误命名（raw 颜色没有交互状态），状态留给 semantic 层。

### 6.3 Layer 2 · Semantic 角色

延用 shadcn 既有约定（无前缀，role-based），Reo 扩展时仍走同一约定：

| 模式 | 示例 | 规则 |
|---|---|---|
| `--<role>` | `--background`、`--card`、`--popover`、`--primary`、`--secondary`、`--destructive`、`--input`、`--muted`、`--accent`、`--ring` | UI 角色名，非颜色名。引用 raw 资产实现，例如 `--primary: var(--brand-red)` |
| `--<role>-foreground` | `--primary-foreground`、`--popover-foreground` | role 的文字色 |
| `--<role>-<state>` | `--primary-hover`、`--destructive-hover` | state 限定在 hover / active / disabled；不在 raw 层使用 |

### 6.4 Layer 3 · Scale token

| 模式 | 示例 | 规则 |
|---|---|---|
| `--radius-<size>` | `--radius-sm`、`--radius-md`、`--radius-lg`、`--radius-xl`、`--radius-2xl`、`--radius-3xl`、`--radius-4xl`、`--radius-full` | T-shirt 与 Tailwind v4 约定一致 |
| `--spacing-N` | `--spacing-4`、`--spacing-8`、... | 像素值数字（保留现有） |
| `--text-<size>` / `--leading-<size>` / `--tracking-<style>` | `--text-body`、`--leading-body`、`--tracking-wide` | 角色名（保留现有） |
| `--font-<family>` | `--font-sans`、`--font-mono`、`--font-memory-serif` | 用途名（保留现有） |

### 6.5 Layer 4 · Effect token

| 模式 | 示例 | 规则 |
|---|---|---|
| `--shadow-<purpose>` | `--shadow-float`、`--shadow-modal`、`--shadow-hero-lift`、`--shadow-hero-fill`、`--shadow-hero-inset`、`--shadow-hero-edge` | 用 purpose 描述功能；Hero 系列统一以 `hero-` 前缀分组 |
| motion duration | `duration-150`、`duration-200`、`duration-280` | 留在 Tailwind utility 与组件局部 keyframe，不引入 motion token |

### 6.6 Layer 5 · Runtime 注入变量（MemoryIcon hue 等）

由 React 组件在挂载时动态写入 root DOM 的变量遵循同一规范：

| 模式 | 示例 | 规则 |
|---|---|---|
| `--memory-hue-<purpose>` | `--memory-hue-base`、`--memory-hue-warm`、`--memory-hue-cool`、`--memory-hue-gradient` | `<scope>-<purpose>`；scope = `memory-hue`，purpose = base/warm/cool/gradient |

运行时变量只在生成它的组件子树内有效，子树外不消费。设计系统源文件不预定义这些变量，由组件契约管理。

### 6.7 Reserved prefix 表（所有新 token 必须落入其中一个）

| prefix | 用途 |
|---|---|
| `--brand-*` | Layer 1 raw 品牌资产 |
| `--surface-N` | Layer 1 raw elevation |
| `--shadow-*` | Layer 4 effect |
| `--radius-*` | Layer 3 scale |
| `--spacing-*` | Layer 3 scale |
| `--text-*` / `--leading-*` / `--tracking-*` / `--font-*` | Layer 3 typography |
| `--memory-hue-*` | Layer 5 runtime |
| 无前缀 | Layer 2 semantic 角色（shadcn 约定） |

不属于以上任何一个 prefix 的命名（例如 `--glass-*`、`--accent-grad`、`--brand-soft`）都被视为命名违规，必须先归入某 prefix 才能进入设计系统。

### 6.8 命名 review 流程

- Phase 1 落地新 token 时，每新增一个名字都对照本节 6.2–6.7 检查 prefix、layer、state、purpose 是否合规。
- 单元测试不强制覆盖命名（命名不是行为），但 Phase 6 文档收口阶段把本节同步进 `design-system/DESIGN.md`，让 Figma Variables 与 source 文件名两侧统一。

## 验证标准

### 整体 success criteria

- `npm run verify:quick` 通过
- light / dark / 跟随系统三种主题在 Memory Studio 富场景下视觉一致融洽
- `?reoScenario=memory-studio-rich` 三 Memory 显示三种 hue，sidebar 选中态、Segment 选中态、Memory Studio titlebar 都体现 hue identity
- RecordingOverlay 三态截图（录音前 / 录音中 / 暂停）作为 spec 证据
- reduced-motion 下 pulse、hover blur 过渡停止；录音中 transcript 仍可滚动、可选中
- Electron renderer 在 1440p 下录音中 paint cost 增加 < 2ms/frame（DevTools Performance 抓取）

### 不退化保障

- 现有所有 Memory / Segment / SegmentSupplement / RecordingOverlay / Workspace 行为不变（增删改、rename、转录、recovery、Memory delete undo、Segment delete grace period 等）
- 现有所有 IPC、preload、main process 表面零改动
- 现有所有 query key、cache invalidation 路径零改动

## 下一步

1. 用户复核本 spec 的 5 个 section + 6 阶段拆分
2. 通过后调用 `superpowers:writing-plans` 起草 **Phase 1 (Tokens)** 的 plan
3. Phase 1 ship 后再用 `writing-plans` 起 Phase 2 plan，按此循环
