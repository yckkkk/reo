---
name: reo-works-design
description: 用于 Reo 作品和右侧栏 Widget 的视觉、交互、可探索图表、diagram、mockup、dashboard、主页组件和轻量 app 设计。内置对齐 Reo app 的当前语义 token、深浅色模板、source->derive->render 反应式模型、可运行黄金范例、模块、复杂度预算和沙箱边界。任何 slider/stepper/拖动/缩放/切换的可交互作品都用它。
---

# Reo Works Design

用于把 Reo 作品、组件和主页组件做成轻量、清楚、能长期留在记忆空间里的视觉/交互产物。输出目标是 runtime bundle 的 `entry.html`、`runtime.json`、`state.json` 和 `assets/`，不是普通说明文。

## 渐进读取

先读本文件选模块，再按作品类型读取 reference。不要一次性打开所有文件，除非作品确实跨多个模块。

- `references/core-design-system.md`：Reo 当前语义 token、排版、深浅色模式、组件规则和 runtime 边界。
- `references/modules.md`：diagram、mockup、interactive/explorable、chart、art 和 dashboard 的选择规则。
- `references/explorables.md`：source->derive->render 反应式模型、坐标系约定和 5 个可复用交互机制；做任何 slider/stepper/拖动/缩放/切换的可探索作品先读它。
- `references/interaction-patterns.md`：局部控件、计算、筛选、排序、stepper 和轻量 app 交互。
- `references/svg-and-diagrams.md`：SVG viewBox、文字、箭头、flowchart、structural 和 illustrative diagram。
- `references/charts.md`：原生 SVG/CSS 图表、dashboard metric、数字格式和本地 vendor 边界。
- `references/mockups-and-art.md`：UI mockup、data record、creative/art 表达和不要做的装饰。
- `examples/`：可运行黄金范例 bundle（双向绑定、派生链、数轴映射、缩放变换、实时度量、窄栏 widget）；读最接近的那个并改写，机制可复用，外皮只是起点。

## 模块选择

- `diagram`：流程图、结构图、解释性 SVG、系统关系。
- `mockup`：界面原型、表单、卡片、设置页、dashboard。
- `interactive` / explorable：带 sliders、steppers、可拖动值、缩放、filters、live calculations 的可探索解释器；按 `references/explorables.md` 的 source->derive->render 模型构建，参照 `examples/`。
- `chart`：小型数据可视化、趋势、分布、对比。
- `art`：插画、生成艺术、创意表达。

选择最接近的模块，不要把所有能力塞进一个作品。一个作品只能有一个主目标；需要更多深度时拆成作品补充。

复杂度预算（默认值，为可读性服务；有清楚理由时可超越）：

- 按**独立源变量**计交互预算，目标 1-2 个，而不是按可见控件或视图数；同一个源投影成多个同步的控件、曲线和读数是被鼓励的简单结构（见 `references/explorables.md`）。
- Diagram box subtitle 不超过 5 个词；细节放到作品下方或后续补充，不塞进框内。
- Diagram 最多 2 个主要视觉角色；如果颜色表达状态或类别，加 1 行 legend。
- 横向 tier 最多 4 个大节点；5 个以上要缩小、换行或拆成 overview/detail。

## 输出顺序

- HTML 文件使用完整轻量文档：`<!doctype html>`、`<meta charset="utf-8">`、`<meta name="viewport" ...>`、短 `<style>`、内容 DOM、最后放 `<script>`。
- CSS 尽量短；组件内部可以用 inline style 保证首屏稳定。
- JS 放在最后，先让静态内容可读，再增强交互。
- 不写代码注释、隐藏模板区、空 tab、空 carousel 或默认 `display: none` 的大量内容。

## 核心设计规则

下面是默认起点，不是想象力的天花板。当某个作品更美、更贴合用户需求时，放手往前做；只要仍然与 Reo 融合、可运行、表达记忆内容，就可以超越这些默认。

- 作品像 Reo 内容区里的自然表达：外框紧凑、清楚，不做营销页；内容画布可以有自己的创作风格。
- 内联预览先展示有用摘要、主要控件和核心结果，避免用户为了理解作品而长滚动；复杂作品可以用 sections、紧凑内部面板、明确的内部滚动、全屏入口或作品补充承载深度。不要把所有作品锁死到同一个固定高度。
- 右侧栏 Widget 必须在 240px 到 520px rail 宽度之间仍然可读、可点、不中断布局；长 Memory 名、主题串、说明文本必须换行或 ellipsis，不允许被视口右侧裁掉。
- 主页组件必须像 Reo 首页内容区的一块可重排组件：外层透明或 `var(--background)`，标准 UI 区域使用 `var(--card)` / `var(--muted)` / `var(--input)` 分层，不要自己造一套组件背景系统。
- 干净来自排版与层级，不是靠剥离效果。用 `var(--shadow-float)` 或 `var(--shadow-surface-inset)` 表达层级，按 Reo 真实强度缩小保留效果；避免发光、噪点、霓虹和大面积模糊。
- 标准组件的强调色必须从 Reo 当前语义 token 派生。真正的内容画布（插画、图表、游戏场景、地图、艺术画面）可以自由使用自定义色彩，但必须和外框边界清楚、文本可读、深浅色不崩。
- 排版对齐 Reo：正文 `var(--text-body)` / `var(--leading-body)`，阅读型可用 `var(--text-body-lg)`；标题 h1 `var(--text-heading-sm)`、h2 `var(--text-subheading)`；UI 标签 `var(--text-ui-sm)` 或 `var(--text-ui-md)`。
- 文案使用句子式大小写；不要全大写，不要用 emoji 表达状态或图标。
- 显示在强调底上的文字必须使用对应 semantic foreground，例如 `var(--primary-foreground)`、`var(--destructive-foreground)` 或 `var(--foreground)`。
- 圆角：小元素 `var(--radius-sm)`，普通元素 `var(--radius-md)`，卡片 `var(--radius-lg)`；单边 border 不加圆角。
- 表格列多时使用 `table-layout: fixed` 或横向包裹；grid 使用 `minmax(0, 1fr)` 防止撑破。
- 所有显示数字必须格式化，避免浮点噪声出现在界面。

## Reo tokens

每个作品 HTML 的 `<style>` 开头必须完整复制下面这份 Reo token block，或先用 `skills/reo-generative-runtime/scripts/scaffold-runtime.mjs` 生成再修改。不要手写缩略版，不要裁剪变量，不要改变量名，不要退回旧的私有 background/text/radius 命名。创作内容层可以在 token block 后定义自己的 scoped palette，例如 `.artwork { --sky: ... }` 或 `.series-a { color: ... }`。

```css
:root,
[data-theme='light'] {
  color-scheme: light;

  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient-from: #ff6a33;
  --brand-gradient-via: #ef4444;
  --brand-gradient-to: #e879f9;
  --brand-gradient: linear-gradient(
    135deg,
    var(--brand-gradient-from) 0%,
    var(--brand-gradient-via) 50%,
    var(--brand-gradient-to) 100%
  );

  --surface-1: #ffffff;
  --surface-2: #f4f4f5;
  --surface-3: #ebebed;
  --surface-4: #ffffff;

  --background: var(--surface-1);
  --foreground: #18181b;
  --card: var(--surface-2);
  --card-foreground: #18181b;
  --popover: var(--surface-4);
  --popover-foreground: #18181b;
  --primary: #18181b;
  --primary-foreground: var(--background);
  --primary-hover: color-mix(in oklab, var(--primary) 86%, var(--background));
  --secondary: #dfe3e8;
  --secondary-foreground: #18181b;
  --muted: var(--surface-2);
  --muted-foreground: #71717a;
  --accent: #d4d9e0;
  --accent-foreground: #18181b;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(24 24 27 / 0.32);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--primary);

  --font-sans: 'Waldenburg', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-memory-serif: 'Songti SC', STSong, 'Noto Serif CJK SC', serif;

  --tracking-heading: 0;
  --tracking-heading-lg: 0;
  --tracking-display: 0;
  --tracking-wide: 0.05em;
  --tracking-wider: 0.1em;

  --text-caption: 10px;
  --leading-caption: 1.4;
  --text-ui-xs: 11px;
  --leading-ui-xs: 1.5;
  --text-ui-sm: 12px;
  --leading-ui-sm: 1.6;
  --text-ui-md: 13px;
  --leading-ui-md: 1.6;
  --text-body: 14px;
  --leading-body: 1.6;
  --text-body-lg: 16px;
  --leading-body-lg: 1.6;
  --text-subheading: 18px;
  --leading-subheading: 1.5;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.4;
  --text-heading: 32px;
  --leading-heading: 1.2;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.2;
  --text-display: 48px;
  --leading-display: 1.1;

  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;

  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-72: 72px;
  --spacing-96: 96px;
  --spacing-160: 160px;

  --container-form: 720px;

  --radius: 16px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-3xl: 28px;
  --radius-4xl: 32px;
  --radius-full: 9999px;

  --shadow-float:
    0 16px 48px rgb(17 24 39 / 0.04), 0 12px 24px rgb(17 24 39 / 0.04),
    0 6px 8px rgb(17 24 39 / 0.02), 0 2px 3px rgb(17 24 39 / 0.02);
  --shadow-modal:
    0 32px 64px rgb(17 24 39 / 0.08), 0 16px 32px rgb(17 24 39 / 0.06),
    0 8px 16px rgb(17 24 39 / 0.04), 0 2px 4px rgb(17 24 39 / 0.03);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.6);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -8px 16px rgb(0 0 0 / 0.12);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.4);
  --shadow-surface-inset: inset 0 1px 0 rgb(0 0 0 / 0.02);
}

[data-theme='dark'] {
  color-scheme: dark;

  --brand-red: #dc2626;
  --brand-magenta: #d946ef;
  --brand-ember: #ff4704;
  --brand-gradient-from: color-mix(in oklab, var(--brand-ember) 92%, var(--surface-1));
  --brand-gradient-via: color-mix(in oklab, var(--brand-red) 92%, var(--surface-1));
  --brand-gradient-to: color-mix(in oklab, var(--brand-magenta) 92%, var(--surface-1));

  --surface-1: #09090b;
  --surface-2: #18181b;
  --surface-3: #1f1f23;
  --surface-4: #27272a;

  --background: var(--surface-1);
  --foreground: #fafafa;
  --card: var(--surface-2);
  --card-foreground: #fafafa;
  --popover: var(--surface-4);
  --popover-foreground: #fafafa;
  --primary: #fafafa;
  --primary-foreground: var(--background);
  --primary-hover: color-mix(in oklab, var(--primary) 86%, var(--background));
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: var(--surface-2);
  --muted-foreground: #a1a1aa;
  --accent: color-mix(in oklab, var(--foreground) 10%, var(--popover));
  --accent-foreground: #fafafa;
  --destructive: #b91c1c;
  --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
  --destructive-foreground: #ffffff;
  --scrim: rgb(0 0 0 / 0.62);
  --border: transparent;
  --input: var(--surface-3);
  --ring: var(--primary);

  --shadow-float:
    0 16px 48px rgb(0 0 0 / 0.5), 0 12px 24px rgb(0 0 0 / 0.24), 0 6px 8px rgb(0 0 0 / 0.22),
    0 2px 3px rgb(0 0 0 / 0.12);
  --shadow-modal:
    0 32px 64px rgb(0 0 0 / 0.6), 0 16px 32px rgb(0 0 0 / 0.32), 0 8px 16px rgb(0 0 0 / 0.28),
    0 2px 4px rgb(0 0 0 / 0.16);
  --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06);
  --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14);
  --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18);
  --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2);
  --shadow-surface-inset: inset 0 1px 0 rgb(255 255 255 / 0.04);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;

    --brand-gradient-from: color-mix(in oklab, var(--brand-ember) 92%, var(--surface-1));
    --brand-gradient-via: color-mix(in oklab, var(--brand-red) 92%, var(--surface-1));
    --brand-gradient-to: color-mix(in oklab, var(--brand-magenta) 92%, var(--surface-1));

    --surface-1: #09090b;
    --surface-2: #18181b;
    --surface-3: #1f1f23;
    --surface-4: #27272a;

    --background: var(--surface-1);
    --foreground: #fafafa;
    --card: var(--surface-2);
    --card-foreground: #fafafa;
    --popover: var(--surface-4);
    --popover-foreground: #fafafa;
    --primary: #fafafa;
    --primary-foreground: var(--background);
    --primary-hover: color-mix(in oklab, var(--primary) 86%, var(--background));
    --secondary: #27272a;
    --secondary-foreground: #fafafa;
    --muted: var(--surface-2);
    --muted-foreground: #a1a1aa;
    --accent: color-mix(in oklab, var(--foreground) 10%, var(--popover));
    --accent-foreground: #fafafa;
    --destructive: #b91c1c;
    --destructive-hover: color-mix(in oklab, var(--destructive) 82%, var(--destructive-foreground));
    --destructive-foreground: #ffffff;
    --scrim: rgb(0 0 0 / 0.62);
    --border: transparent;
    --input: var(--surface-3);
    --ring: var(--primary);

    --shadow-float:
      0 16px 48px rgb(0 0 0 / 0.5), 0 12px 24px rgb(0 0 0 / 0.24), 0 6px 8px rgb(0 0 0 / 0.22),
      0 2px 3px rgb(0 0 0 / 0.12);
    --shadow-modal:
      0 32px 64px rgb(0 0 0 / 0.6), 0 16px 32px rgb(0 0 0 / 0.32), 0 8px 16px rgb(0 0 0 / 0.28),
      0 2px 4px rgb(0 0 0 / 0.16);
    --shadow-hero-lift: 0 24px 48px rgb(220 38 38 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.06);
    --shadow-hero-fill: 0 12px 24px rgb(220 38 38 / 0.28), inset 0 0 0 1px rgb(255 255 255 / 0.14);
    --shadow-hero-inset: inset 0 1px 0 rgb(255 255 255 / 0.25), inset 0 -8px 16px rgb(0 0 0 / 0.18);
    --shadow-hero-edge: inset 0 0 0 1px rgb(255 255 255 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.2);
    --shadow-surface-inset: inset 0 1px 0 rgb(255 255 255 / 0.04);
  }
}
```

常用组件 token：

- Border：默认不画实线边框；需要分隔时用 `outline: 1px solid color-mix(in oklab, var(--foreground) 10%, transparent)` 或 `box-shadow: var(--shadow-surface-inset)`。
- Card：`background: var(--card); color: var(--card-foreground); border-radius: var(--radius-lg); box-shadow: var(--shadow-float); padding: var(--spacing-16);`。
- Metric card：`background: var(--muted); border-radius: var(--radius-md); box-shadow: var(--shadow-surface-inset); padding: var(--spacing-12) var(--spacing-16);`，label 用 `var(--text-ui-sm)`，value 用 22-24px / 500。
- Control：`background: var(--input); color: var(--foreground); border-radius: var(--radius-md);`。
- Focus ring：`outline: 2px solid var(--ring); outline-offset: 2px;`。

## 画框与内容色彩

画框、按钮、输入、tabs、卡片、列表、表单、tooltip、popover 和标准状态从 Reo 语义 token 派生：

- 主要动作 / 选中：`var(--primary)` + `var(--primary-foreground)`。
- 安静选中态：`color-mix(in oklab, var(--primary) 12%, var(--background))`。
- 进度 / 正向信号：`color-mix(in oklab, var(--primary) 70%, var(--background))`。
- 警告 / 负向信号：`var(--destructive)` 或 `color-mix(in oklab, var(--destructive) 16%, var(--background))`。
- 次级信息：`var(--muted-foreground)`。

内容画布不是画框。画、游戏画面、封面、地图、数据图形、系列颜色、插画和创意对象可以自由创作：可以使用自定义色板、渐变、纹理、图片、生成资产或特定主题色。约束是：

- 自定义色彩要 scoped 在内容容器内，不接管 body、按钮、输入、tab、卡片等标准组件。
- 如果文字落在自定义底色上，自己保证可读性；不要依赖 Reo token 自动兜底。
- 深浅色至少要有一个明确策略：为内容色写 `[data-theme='dark']` / media override，或确认这是一个在两种模式下都成立的艺术画面。
- 不要把旧 works 结构 token 当成新规范继续传播；结构仍然用 `--background`、`--card`、`--foreground`、`--radius-*`、`--shadow-*`。

## 组件模板

Interactive explainer：顶部放 1-3 个控制，下面放核心结果和可视化。Sliders 设置合适 `step`，输出值必须格式化。

Comparison：使用 `display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--spacing-12);`。每个选项一个 card，推荐项只用边框、轻背景或小 badge 强调。

Dashboard：先放 2-4 个 metric cards，再放 chart/列表；不要把整页再包一层大卡片。

Data record：单个有边界的对象可以用一张 raised card；不要卡片套卡片。

Diagram：SVG 默认 `rx="4"`；只有真正 pill 标签才用更大圆角。连接线少而清楚，节点文字短。

## 沙箱边界

- 普通 Web 网络、CDN、远程图片、远程字体、`fetch`、XHR、WebSocket、表单和下载可以使用；第三方 API 仍受浏览器 CORS 限制。
- 可以使用 inline CSS、inline JS、data/blob 图片、网络资源，或 `assets/` 下的本地资源。
- 可以用 `window.reo.media.readPlaybackAudio` 读取 Reo 已有录音或 ready 笔记语音 bytes；媒体播放器是作品或 Widget 自己的 UI 和状态，不是 Reo host 状态。
- 不使用 Node、Electron、raw filesystem path、`file://`、symlink 或 `.reo/` 内部文件。
- 不存储凭证、绝对路径、本机用户名、token 或用户没有要求展示的隐私内容。

## 轻量性能规则

- 首屏 HTML 目标小于 200KB；复杂作品优先拆为作品补充。
- 避免每帧重排、无限动画、大量 DOM 节点、大图片和大 base64。
- 事件监听器只绑需要交互的控件；没有必要不要使用 animation loop。
- 如果使用 canvas，固定 wrapper 高度并按设备像素比控制绘制，不要让 canvas 自动撑破布局。
- 数据更新优先使用 `window.reo.state` 写入 `state.json`，或由 agent 后续重写 `state.json` / `entry.html`；快速 UI cache 可用 browser storage。
