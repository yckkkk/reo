---
name: reo-works
description: 用于在 Reo 记忆空间中创建或更新 agent-created 作品片段和作品补充；作品以 artifact 合同保存，首个格式是 html。
---

# Reo Works

用于创建或更新 Reo 作品。作品是 agent 基于当前 Memory、Segment、Supplement 或用户提供材料生成的轻量视觉/交互产物，例如复习表、复盘看板、解释器、对照卡片、图表、diagram、原型或创意页面。

## 渐进读取

先读本文件判断目标，再只读取需要的 reference：

- `references/file-contract.md`：新建或更新作品片段、作品补充的落文件合同。
- `references/workflows.md`：从 Reo prompt、Memory 数据和既有作品推进创建/更新的步骤。
- `references/runtime-contract-check.md`：提交前的文件合同、runtime bundle 和 Reo 投影检查。
- 运行时 bundle、状态、模板和脚本先读 `skills/reo-generative-runtime/SKILL.md`。
- 用户未指定风格时默认按 `reo-works-design` 的 Reo 视觉变量和参考模块；用户明确指定风格时仍继续读 `skills/reo-works-design/SKILL.md` 对齐布局、交互和 runtime 边界。

## 使用场景

- 用户要求新建作品、生成界面、生成 dashboard、复习表、图表、diagram、mockup、互动解释器或创意页面。
- 用户从 Reo 的作品入口复制 prompt，要求你在当前记忆空间内落文件。
- 用户要求更新已有作品，让作品反映新的片段、笔记、录音转录或记忆数据。

如果目标不清楚，先用 2-4 个问题确认目标、受众、数据来源、更新频率和交互复杂度。目标足够明确时，先给 3 个方向供用户选择；用户已经指定方向时直接执行。

## 创建作品片段

1. 从 prompt 中读取目标 Memory 目录和建议标题；必要时读取该 Memory 下的 `memory.md`、相关 `segment.md`、`supplement.md` 和普通数据文件。
2. 生成 Reo Segment id：`seg_YYYYMMDDHHMMSS_8hex`，例如 `seg_20260604024800_a1b2c3d4`；目录名前缀和 `segment.md` frontmatter 必须使用同一个 id。
3. 在 `memories/<memory-directory>/segments/` 下创建一个清楚命名的 Segment 目录，例如 `seg_20260604024800_a1b2c3d4--间隔复习表`。
4. 写入 `segment.md`，frontmatter 必须包含稳定 `id`、`title`、`kind: artifact`、`format: html`。
5. 按 `skills/reo-generative-runtime/SKILL.md` 写入同目录 runtime bundle：`entry.html`、`runtime.json`、`state.json`、`assets/`。
6. 可先运行 `node skills/reo-generative-runtime/scripts/scaffold-runtime.mjs <segment-directory> --title "标题" --template <family>`，再把 scaffold 改成用户需要的作品。

最小形态：

```markdown
---
id: seg_20260604024800_a1b2c3d4
title: 间隔复习表
kind: artifact
format: html
---
# 间隔复习表

Agent-created runtime work. Entry: `entry.html`.
```

## 创建作品补充

1. 从 prompt 中读取目标 Segment 目录。
2. 生成 Reo Supplement id：`sup_YYYYMMDDHHMMSS_8hex`，例如 `sup_20260604024900_d4c3b2a1`；目录名前缀和 `supplement.md` frontmatter 必须使用同一个 id。
3. 在目标 Segment 的 `supplements/` 下创建一个清楚命名的 Supplement 目录，例如 `sup_20260604024900_d4c3b2a1--复习补充`。
4. 写入 `supplement.md`，frontmatter 必须包含稳定 `id`、`title`、`kind: artifact`、`format: html`。
5. 按 `skills/reo-generative-runtime/SKILL.md` 写入同目录 runtime bundle：`entry.html`、`runtime.json`、`state.json`、`assets/`。

最小形态：

```markdown
---
id: sup_20260604024900_d4c3b2a1
title: 复习补充
kind: artifact
format: html
---
# 复习补充

Agent-created runtime work supplement. Entry: `entry.html`.
```

## 更新作品

- 先读取目标 `segment.md` 或 `supplement.md`，确认它是 `kind: artifact`、`format: html`。
- 读取同目录 `entry.html`、`runtime.json`、`state.json` 和 prompt 指定的数据来源。
- 保留稳定 id 和对象目录；除非用户要求重命名，否则不要改 title 或目录 basename。
- 更新 HTML、state 或 assets 时保持轻量，删除不再需要的 `assets/` 旧文件；不要编辑 `.reo/index.json`、manifest、lock 或 hash 字段。

## 文件合同

- 用户可见类型名是作品；文件合同字段是 `kind: artifact` 和 `format: html`。
- 新建 Segment id 使用 `seg_YYYYMMDDHHMMSS_8hex`；新建 Supplement id 使用 `sup_YYYYMMDDHHMMSS_8hex`。已有 Reo 对象可能使用更早的合法 id；新作品不要发明 `seg_agent_*` / `sup_agent_*` 这类占位 id。
- 运行入口统一是 `entry.html`；Segment 和 Supplement 不再使用不同入口名。
- `runtime.json` 描述作品意图、模板、state stores 和未来 bridge needs；它不是权限审批文件。
- `state.json` 是用户和 agent 可查看、可修改的状态文件；打卡、待办、进度、偏好和需要下次打开仍记得的用户操作结果必须写入 `state.json`，localStorage/IndexedDB 只能作为快速 UI cache 或兼容缓存，不能作为唯一长期状态。
- Reo 会计算入口 bytes/hash 并收敛 manifest；agent 不写 `.reo/objects`。
- 本地资源放在 `assets/`；不要创建 symlink，不要引用 absolute path 或 `file://`。
- 不要创建空白占位作品；只有当 HTML 入口已经表达用户可见价值时才落文件。

## 设计与交互

- 用户未指定风格时默认按 `reo-works-design` 的 Reo 视觉变量和参考模块。
- 视觉、图表、diagram、dashboard、mockup 和交互控件先读 `skills/reo-works-design/SKILL.md` 及其 `references/`。
- 作品内可以有 DOM 交互、过滤、排序、计算、切换、表单、下载和普通 Web 网络。
- 由 slider/stepper/拖动/缩放/切换驱动图表的可交互作品按 source→derive→render 反应式模型组织：1-2 个独立源变量 → 纯 derive() → render；先读 `skills/reo-works-design/references/explorables.md` 与可运行的 `skills/reo-works-design/examples/`，把范例当起点而非天花板。
- 作品需要 Reo state、content、mutation、fullscreen 或 agent prompt action 时，使用 `window.reo` documented bridge；不要发明其他宿主 API。
- 作品需要播放 Reo 里已有录音或 ready 笔记语音时，用 `window.reo.media.readPlaybackAudio` 读取 bytes；播放器 UI、Blob URL 生命周期、错误显示和状态由作品自己实现。
- 如果使用第三方库，优先选择浏览器/CDN 可直接运行的方式；第三方 API 是否可用取决于浏览器 CORS。

## 验证

- 确认 `segment.md`/`supplement.md` frontmatter 可读，且同目录 runtime bundle 存在。
- 运行 `node skills/reo-generative-runtime/scripts/validate-runtime.mjs <target-directory>`。
- 确认入口 HTML 不包含凭证明文、绝对路径或本机私有路径。
- 确认所有屏幕上的数字都经过 `Math.round()`、`.toFixed()` 或 `Intl.NumberFormat`。
- 直接验证文件效果后停止；Reo 会在打开、刷新或保存时投影作品。
