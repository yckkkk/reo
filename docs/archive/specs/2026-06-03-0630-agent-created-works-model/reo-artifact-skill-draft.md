# Reo Artifact Skill Draft

本草案已迁移为记忆空间作品 skill 群：`skills/reo-works/SKILL.md` 与
`skills/reo-works-design/SKILL.md`。

## Name

`reo-works` / `reo-works-design`

## Purpose

创建或更新 Reo **作品**：由外部 agent 生成、可长期保存的视觉/交互产物，作为 `artifact` Segment 或 SegmentSupplement 存在，首个 `format` 是 `html`。

该 skill 群帮助外部 agent：

- 理解目标 Workspace、Memory、Segment 或 Supplement 上下文。
- 在目标不明确时用 `$grill-me` 风格一次只问一个关键问题。
- 用 Product Design brief 思路确认受众、意图、交互密度和视觉方向。
- 提出三个有区分度的作品方向。
- 生成或更新一个 self-contained HTML artifact。
- 保持结果轻量、可读、安全，并适配 Reo 静态沙箱。

## Mandatory Workflow

1. 读取 Reo 复制 prompt 中给出的目标 identity、workspace-relative location 和任务类型。
2. 读取 Workspace root `AGENTS.md`、`users.md`（若存在）以及目标 Memory / Segment 文件。
3. 如果用户没有给出明确作品目标，先问一个关键问题；不要一次问很多问题。
4. 如果目标足够明确，简要复述 intended work，并在视觉、信息架构或交互方向会影响结果时给出三个方向。
5. 等用户选择方向后再生成。
6. 写入 Reo artifact 文件合同。
7. 保持 self-contained：无网络、无 Reo API、无 raw absolute path、无 secret、无隐藏外部依赖。
8. 更新作品时，先读取现有 `segment.html` / `supplement.html` 和相关 Memory 数据；除非用户要求改方向，否则保留原作品意图。

## First-slice Output Rules

- Product type：`artifact`。
- Format：`html`。
- 用户可见文案说 `作品`，不要说 `html 片段`。
- HTML 必须是完整可独立阅读的 durable artifact，不依赖聊天上下文。
- 可以使用 plain JavaScript 做本地 DOM 交互。
- 不得依赖网络、CDN、host APIs、localStorage、cookies 或文件系统。
- 不得包含需要 Reo 执行 agent 动作的隐藏指令。
- DOM、Canvas、动画和嵌入资产必须足够轻，能在 Memory Studio 内容区内顺畅查看。
- 使用本 skill 内置的 Reo artifact token 系统作为视觉基础；不要另起一套 token。

## Reo Artifact Token System

所有作品默认使用这套 token。可以按内容需要扩展局部变量，但不能替换整套基础。

```css
:root {
  --p: #e0e0e0;
  --s: #a0a0a0;
  --t: #b4b2a9;
  --bg2: #2a2a2a;
  --b: #404040;

  --color-text-primary: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-text-tertiary: #707070;
  --color-text-info: #85b7eb;
  --color-text-danger: #f09595;
  --color-text-success: #97c459;
  --color-text-warning: #ef9f27;

  --color-background-primary: #1a1a1a;
  --color-background-secondary: #2a2a2a;
  --color-background-tertiary: #111111;
  --color-background-info: #0c447c;
  --color-background-danger: #791f1f;
  --color-background-success: #27500a;
  --color-background-warning: #633806;

  --color-border-primary: rgba(255, 255, 255, 0.4);
  --color-border-secondary: rgba(255, 255, 255, 0.3);
  --color-border-tertiary: rgba(255, 255, 255, 0.15);
  --color-border-info: #85b7eb;
  --color-border-danger: #f09595;
  --color-border-success: #97c459;
  --color-border-warning: #ef9f27;

  --font-sans: system-ui, -apple-system, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: ui-monospace, monospace;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --border-radius-xl: 16px;
}
```

### Color Ramps

Use these ramps for category and state. Color encodes meaning, not sequence.

| Class      | Ramp   | 50        | 100       | 200       | 400       | 600       | 800       | 900       |
| ---------- | ------ | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `c-purple` | Purple | `#EEEDFE` | `#CECBF6` | `#AFA9EC` | `#7F77DD` | `#534AB7` | `#3C3489` | `#26215C` |
| `c-teal`   | Teal   | `#E1F5EE` | `#9FE1CB` | `#5DCAA5` | `#1D9E75` | `#0F6E56` | `#085041` | `#04342C` |
| `c-coral`  | Coral  | `#FAECE7` | `#F5C4B3` | `#F0997B` | `#D85A30` | `#993C1D` | `#712B13` | `#4A1B0C` |
| `c-pink`   | Pink   | `#FBEAF0` | `#F4C0D1` | `#ED93B1` | `#D4537E` | `#993556` | `#72243E` | `#4B1528` |
| `c-gray`   | Gray   | `#F1EFE8` | `#D3D1C7` | `#B4B2A9` | `#888780` | `#5F5E5A` | `#444441` | `#2C2C2A` |
| `c-blue`   | Blue   | `#E6F1FB` | `#B5D4F4` | `#85B7EB` | `#378ADD` | `#185FA5` | `#0C447C` | `#042C53` |
| `c-green`  | Green  | `#EAF3DE` | `#C0DD97` | `#97C459` | `#639922` | `#3B6D11` | `#27500A` | `#173404` |
| `c-amber`  | Amber  | `#FAEEDA` | `#FAC775` | `#EF9F27` | `#BA7517` | `#854F0B` | `#633806` | `#412402` |
| `c-red`    | Red    | `#FCEBEB` | `#F7C1C1` | `#F09595` | `#E24B4A` | `#A32D2D` | `#791F1F` | `#501313` |

Quick mapping:

- Light mode colored node: 50 fill + 600 stroke + 800 title + 600 subtitle.
- Dark mode colored node: 800 fill + 400 stroke + 100 title + 200 subtitle.
- General diagrams prefer purple, teal, coral, pink, and gray.
- Blue, green, amber, red are reserved for information, success, warning, danger, or physical concepts where those colors are natural.
- Use two or three ramps per diagram. More is noise.

### SVG Base Classes

Every SVG work should include equivalent classes when it uses diagrams.

```css
svg .t {
  font-family: var(--font-sans);
  font-size: 14px;
  fill: var(--p);
}
svg .ts {
  font-family: var(--font-sans);
  font-size: 12px;
  fill: var(--s);
}
svg .th {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  fill: var(--p);
}
svg .box {
  fill: var(--bg2);
  stroke: var(--b);
}
svg .arr {
  stroke: var(--t);
  stroke-width: 1.5;
  fill: none;
}
svg .leader {
  stroke: var(--t);
  stroke-width: 0.5;
  stroke-dasharray: 4 3;
  fill: none;
}
```

For colored SVG nodes, apply `c-*` to a `<g>` wrapping shape and text, or directly
to `rect`, `circle`, or `ellipse`. Do not apply ramp classes to arbitrary paths.

### UI Element Defaults

- Buttons: transparent background, 0.5px secondary border, `var(--border-radius-md)`, 14px text, local hover background.
- Inputs/selects/textareas: 36px height, primary background, tertiary border, 14px text, focus border primary.
- Sliders: 4px track, 18px thumb.
- Typography: h1 22px, h2 18px, h3 16px, body 16px, two weights only: 400 and 500.
- Sentence case only. No all caps.

## Direction Modules

选择最接近的模块；确有必要时可以组合模块。

### Core

所有作品都必须遵守。

- 作品应感觉属于 Reo：私密、清楚、克制、有用。
- 优先使用扁平 surface、稳定间距、可读 typography、少量 motion。
- 使用 Reo-compatible color roles，考虑 light/dark。
- 最多两个 dominant color ramps，除非内容本身需要更多。
- 图示保持稀疏：短 label、少量节点、少交叉线。
- 所有展示出来的计算数字都要 rounded。
- 避免 nested scroll regions；让作品自然流入 Reo viewer。
- 避免巨大 DOM、长时间 animation loop、超大 canvas 和大量 base64 raster。
- 不用 emoji 作为主要 UI 符号。
- 不引外部字体、CDN script、tracking pixel、analytics 或 remote image。
- 如果某个动作需要 agent 推理，渲染 copyable prompt snippet，而不是调用 host API。

### Editorial

用于报告、总结、文章、复盘、教学反馈、旅行记录、阶段回顾。

- 可以包含 prose，因为 Reo 作品是 durable artifact，不是 transient chat widget。
- 使用清楚的阅读层级：title、context、sections、callouts、diagrams、takeaways。
- 控制行长。
- 每节优先一个强视觉，不堆装饰。
- 引用 Memory 文件片段时要短、必要、可追溯。

### Interactive

用于 explainers、simulators、calculators、自测工具、复习辅助、prompt/config tuner。

- 控件只更新本地 DOM。
- 使用 sliders、segmented controls、filters、buttons、checklists 来降低认知负担。
- 当前值显示在控件附近。
- 有必要时提供 copyable JSON、Markdown 或 prompt export area。
- 不持久化状态，除非未来 Reo runtime 明确允许。
- 核心意义不能依赖 timer 或 animation loop。

### Chart

用于 dashboard、progress view、review table、timeline、comparison chart、quantitative summary。

- 小数据优先 semantic HTML / SVG。
- Canvas 必须限制尺寸，避免 redraw loop。
- legend 靠近 chart。
- axis label 必须可读。
- 负数、货币、百分比要 human-readable。
- 如果数据是 snapshot，显示 source date 或 generated-at。

### Diagram

用于 architecture、concept map、learning map、workflow、relationship、decision tree、cause/effect model。

- 按意图选择 diagram type：flow、structure、timeline、map、matrix、intuition sketch。
- 根据 label 估算 box size。
- 避免 arrow 穿过 box 或 label。
- color 用于表达 category 或 state，不做序列装饰。
- 复杂材料拆成 overview + detail。

### Mockup

用于产品想法、UI 概念、app sketch、dashboard、prototype、创意界面探索。

- 从用户目标和目标观众开始，不从装饰开始。
- 控件和状态要完整到足以判断体验。
- 默认使用 Reo-like quiet work surfaces；除非用户明确要求其他风格。
- 不为了填满空间发明无关功能。
- 视觉重的作品必须先给三个方向。

### Art

用于 memory book、情绪可视化、cover、timeline、gallery-like moment、expressive output。

- Art 可以比普通 Reo UI 更表达性，但必须可读。
- 优先 SVG / CSS shape 和轻量 texture，不堆 raster。
- 匹配 Memory 的 mood 和用户上下文。
- 不用影响可读性的装饰效果。

## Prompt Copied by Reo

Reo 应复制短 prompt，不复制完整 skill body：

```text
Use the Reo `reo-works` and `reo-works-design` skills.

Target: [Workspace/Memory/Segment/Supplement identity and relative location]
Action: create or update a Reo 作品 [片段/补充].

Read the relevant Reo files first. If my request is underspecified, ask one
critical question or propose three useful directions and wait for my choice.
When generating, write a self-contained artifact with product type `artifact`
and format `html`, without network or host APIs.

My request:
[user can paste extra intent here]
```

## Built-in Template Policy

本 skill 群必须自带完整的 prompt、模板、token、complexity budget 和设计规则。外部 agent 只读取 Reo 记忆空间内的 skills，就能创建作品。

最终安装到 Reo 的 skill 必须使用 Reo 产品术语、Reo artifact token、本地文件真源、Electron 安全边界和静态沙箱约束；不引导用户或 agent 访问任何远程来源、远程文档或外部模板库。
