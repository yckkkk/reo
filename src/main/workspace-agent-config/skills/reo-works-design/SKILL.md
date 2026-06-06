---
name: reo-works-design
description: 用于 Reo 作品和右侧栏 Widget 的视觉、交互、可探索图表、diagram、mockup、dashboard 和轻量 app 设计。内置对齐 Reo app 的视觉真值、source→derive→render 反应式模型、可运行黄金范例、模块、复杂度预算和沙箱边界。任何 slider/stepper/拖动/缩放/切换的可交互作品都用它。
---

# Reo Works Design

用于把 Reo 作品做成轻量、清楚、能长期留在记忆空间里的视觉/交互产物。输出目标是 runtime bundle 的 `entry.html`、`runtime.json`、`state.json` 和 `assets/`，不是普通说明文。

## 渐进读取

先读本文件选模块，再按作品类型读取 reference。不要一次性打开所有文件，除非作品确实跨多个模块。

- `references/core-design-system.md`：Reo 作品视觉变量、排版、颜色、深色模式和 runtime 边界。
- `references/modules.md`：diagram、mockup、interactive/explorable、chart、art 和 dashboard 的选择规则。
- `references/explorables.md`：source→derive→render 反应式模型、坐标系约定和 5 个可复用交互机制；做任何 slider/stepper/拖动/缩放/切换的可探索作品先读它。
- `references/interaction-patterns.md`：局部控件、计算、筛选、排序、stepper 和轻量 app 交互。
- `references/svg-and-diagrams.md`：SVG viewBox、文字、箭头、flowchart、structural 和 illustrative diagram。
- `references/charts.md`：原生 SVG/CSS 图表、dashboard metric、数字格式和本地 vendor 边界。
- `references/mockups-and-art.md`：UI mockup、data record、creative/art 表达和不要做的装饰。
- `examples/`：可运行黄金范例 bundle（双向绑定、派生链、数轴映射、缩放变换、实时度量、窄栏 widget）；读最接近的那个并改写，机制可复用，外皮只是起点。

## 模块选择

- `diagram`：流程图、结构图、解释性 SVG、系统关系。
- `mockup`：界面原型、表单、卡片、设置页、dashboard。
- `interactive` / explorable：带 sliders、steppers、可拖动值、缩放、filters、live calculations 的可探索解释器；按 `references/explorables.md` 的 source→derive→render 模型构建，参照 `examples/`。
- `chart`：小型数据可视化、趋势、分布、对比。
- `art`：插画、生成艺术、创意表达。

选择最接近的模块，不要把所有能力塞进一个作品。一个作品只能有一个主目标；需要更多深度时拆成作品补充。

复杂度预算（默认值，为可读性服务；有清楚理由时可超越）：
- 按**独立源变量**计交互预算，目标 1–2 个，而不是按可见控件或视图数；同一个源投影成多个同步的控件、曲线和读数是被鼓励的简单结构（见 `references/explorables.md`）。
- Diagram box subtitle 不超过 5 个词；细节放到作品下方或后续补充，不塞进框内。
- Diagram 最多 2 个主要色阶；如果颜色表达状态或类别，加 1 行 legend。
- 横向 tier 最多 4 个大节点；5 个以上要缩小、换行或拆成 overview/detail。

## 输出顺序

- HTML 文件使用完整轻量文档：`<!doctype html>`、`<meta charset="utf-8">`、`<meta name="viewport" ...>`、短 `<style>`、内容 DOM、最后放 `<script>`。
- CSS 尽量短；组件内部可以用 inline style 保证首屏稳定。
- JS 放在最后，先让静态内容可读，再增强交互。
- 不写代码注释、隐藏模板区、空 tab、空 carousel 或默认 `display: none` 的大量内容。

## 核心设计规则

下面是默认起点，不是想象力的天花板。当某个作品更美、更贴合用户需求时，放手往前做；只要仍然与 Reo 融合、可运行、表达记忆内容，就可以超越这些默认。

- 作品像 Reo 内容区里的自然表达：扁平、紧凑、清楚，不做营销页。
- 内联预览先展示有用摘要、主要控件和核心结果，避免用户为了理解作品而长滚动；复杂作品可以用 sections、紧凑内部面板、明确的内部滚动、全屏入口或作品补充承载深度。不要把所有作品锁死到同一个固定高度。
- 右侧栏 Widget 必须在 240px 到 520px rail 宽度之间仍然可读、可点、不中断布局。
- 外层背景保持透明或 `var(--color-background-primary)`；不要用深色/彩色外层背景吞掉宿主界面。
- 干净来自排版与层级，不是靠剥离效果。用克制的 elevation（`var(--shadow-card)`）表达层级，按 Reo 真实强度缩小保留效果；避免发光、噪点、霓虹和大面积模糊，渐变只在明确创意场景下用极淡品牌色且不伤可读性。
- 强调色用作品自己的分类色阶（`c-purple`/`c-teal`/`c-coral`/`c-pink` 等）；Reo 品牌色 red/magenta/ember 保留给宿主品牌，不作为作品强调色。
- 排版对齐 Reo：正文 14px（阅读型可用 16px）、line-height 1.6；字重 300–600，常规 400、强调 500/600；标题 h1 20px、h2 18px、h3 16px；ui 标签 12–13px，正文避免小于 11px。
- 文案使用句子式大小写；不要全大写，不要用 emoji 表达状态或图标。
- 显示在彩色底上的文字必须使用同色阶的深色 stop，不使用黑色或通用灰色。
- 圆角：小元素 `var(--border-radius-sm)`，普通元素 `var(--border-radius-md)`，卡片 `var(--border-radius-lg)`；单边 border 不加圆角。
- 表格列多时使用 `table-layout: fixed` 或横向包裹；grid 使用 `minmax(0, 1fr)` 防止撑破。
- 所有显示数字必须格式化，避免浮点噪声出现在界面。

## Reo tokens

每个作品 HTML 的 `<style>` 开头应包含必要 token。可以裁剪未使用变量，但不要改变量名。

```css
:root {
  --color-background-primary: #ffffff;
  --color-background-secondary: #f4f4f5;
  --color-background-tertiary: #ebebed;
  --color-background-info: #e6f1fb;
  --color-background-danger: #fcebeb;
  --color-background-success: #eaf3de;
  --color-background-warning: #faeeda;
  --color-text-primary: #18181b;
  --color-text-secondary: #3f3f46;
  --color-text-tertiary: #71717a;
  --color-text-info: #0c447c;
  --color-text-danger: #791f1f;
  --color-text-success: #27500a;
  --color-text-warning: #633806;
  --color-border-tertiary: rgba(24, 24, 27, 0.08);
  --color-border-secondary: rgba(24, 24, 27, 0.14);
  --color-border-primary: rgba(24, 24, 27, 0.22);
  --font-sans: "Waldenburg", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: "Songti SC", "Noto Serif CJK SC", ui-serif, Georgia, Cambria, "Times New Roman", serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
  --border-radius-xl: 20px;
  --shadow-card: 0 1px 2px rgba(17, 24, 39, 0.04), 0 2px 8px rgba(17, 24, 39, 0.05);
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary: #09090b;
    --color-background-secondary: #18181b;
    --color-background-tertiary: #1f1f23;
    --color-background-info: #0c447c;
    --color-background-danger: #791f1f;
    --color-background-success: #27500a;
    --color-background-warning: #633806;
    --color-text-primary: #fafafa;
    --color-text-secondary: #d4d4d8;
    --color-text-tertiary: #a1a1aa;
    --color-text-info: #b5d4f4;
    --color-text-danger: #f7c1c1;
    --color-text-success: #c0dd97;
    --color-text-warning: #fac775;
    --color-border-tertiary: rgba(255, 255, 255, 0.10);
    --color-border-secondary: rgba(255, 255, 255, 0.16);
    --color-border-primary: rgba(255, 255, 255, 0.24);
    --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 10px rgba(0, 0, 0, 0.34);
  }
}
```

常用组件 token：
- Border：`0.5px solid var(--color-border-tertiary)`，强调可用 `var(--color-border-secondary)`。
- Card：`background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); box-shadow: var(--shadow-card); padding: 1rem 1.25rem;`。
- Metric card：`background: var(--color-background-secondary); border-radius: var(--border-radius-md); box-shadow: var(--shadow-card); padding: 1rem;`，label 13px，value 24px/500。
- Focus ring：用 `box-shadow: 0 0 0 2px var(--color-border-primary)`，或与同色阶强调色对齐。

## 色阶

颜色表达类别或物理含义，不按顺序彩虹循环。通用分类优先 `c-purple`、`c-teal`、`c-coral`、`c-pink`；结构中性用 `c-gray`（与结构 token 同为 Reo zinc 中性）；信息/成功/警告/危险才使用 blue/green/amber/red。这些是分类强调色，与 Reo 品牌色 red/magenta/ember 分离；色阶是默认，按需要可在同一色相内派生新 stop。

| Class | 50 | 100 | 200 | 400 | 600 | 800 | 900 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `c-purple` | #EEEDFE | #CECBF6 | #AFA9EC | #7F77DD | #534AB7 | #3C3489 | #26215C |
| `c-teal` | #E1F5EE | #9FE1CB | #5DCAA5 | #1D9E75 | #0F6E56 | #085041 | #04342C |
| `c-coral` | #FAECE7 | #F5C4B3 | #F0997B | #D85A30 | #993C1D | #712B13 | #4A1B0C |
| `c-pink` | #FBEAF0 | #F4C0D1 | #ED93B1 | #D4537E | #993556 | #72243E | #4B1528 |
| `c-gray` | #F4F4F5 | #E4E4E7 | #D4D4D8 | #A1A1AA | #71717A | #3F3F46 | #18181B |
| `c-blue` | #E6F1FB | #B5D4F4 | #85B7EB | #378ADD | #185FA5 | #0C447C | #042C53 |
| `c-green` | #EAF3DE | #C0DD97 | #97C459 | #639922 | #3B6D11 | #27500A | #173404 |
| `c-amber` | #FAEEDA | #FAC775 | #EF9F27 | #BA7517 | #854F0B | #633806 | #412402 |
| `c-red` | #FCEBEB | #F7C1C1 | #F09595 | #E24B4A | #A32D2D | #791F1F | #501313 |

Light mode quick pick：50 fill、600 stroke、800 title、600 subtitle。Dark mode quick pick：800 fill、200 stroke、100 title、200 subtitle。

SVG text classes：
- `.t`：primary text。
- `.ts`：secondary text。
- `.th`：heading text。
- 彩色 group 使用 `.c-purple` 等类名，并在同 group 内分别给 shape 和 text 指定对应 stop。

## 组件模板

Interactive explainer：顶部放 1-3 个控制，下面放核心结果和可视化。Sliders 设置合适 `step`，输出值必须格式化。

Comparison：使用 `display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;`。每个选项一个 card，推荐项只用边框或小 badge 强调。

Dashboard：先放 2-4 个 metric cards，再放 chart/列表；不要把整页再包一层大卡片。

Data record：单个有边界的对象可以用一张 raised card；不要卡片套卡片。

Diagram：SVG 默认 `rx="4"`；只有真正 pill 标签才用更大圆角。连接线少而清楚，节点文字短。

## 沙箱边界

- 普通 Web 网络、CDN、远程图片、远程字体、`fetch`、XHR、WebSocket、表单和下载可以使用；第三方 API 仍受浏览器 CORS 限制。
- 可以使用 inline CSS、inline JS、data/blob 图片、网络资源，或 `assets/` 下的本地资源。
- 不使用 Node、Electron、raw filesystem path、`file://`、symlink 或 `.reo/` 内部文件。
- 不存储凭证、绝对路径、本机用户名、token 或用户没有要求展示的隐私内容。

## 轻量性能规则

- 首屏 HTML 目标小于 200KB；复杂作品优先拆为作品补充。
- 避免每帧重排、无限动画、大量 DOM 节点、大图片和大 base64。
- 事件监听器只绑需要交互的控件；没有必要不要使用 animation loop。
- 如果使用 canvas，固定 wrapper 高度并按设备像素比控制绘制，不要让 canvas 自动撑破布局。
- 数据更新优先使用 `window.reo.state` 写入 `state.json`，或由 agent 后续重写 `state.json` / `entry.html`；快速 UI cache 可用 browser storage。
