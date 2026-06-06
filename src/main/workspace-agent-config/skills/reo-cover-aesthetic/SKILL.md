---
name: reo-cover-aesthetic
description: 用于创建、判断或改进 Reo Memory 与 Segment 封面提示词或生成图，尤其用于避免泛用、内嵌边框、文字过多、UI 化或低质量封面。
---

# Reo Cover Aesthetic

这是基于开源 `aesthetic` skill 优化后的 Reo 封面审美 skill。它应该独立工作，不要求 agent 再安装其它 skill。

## 使用场景

适用：
- 为 Reo Memory 或 Segment 生成、重写或评估封面提示词。
- 判断候选封面是否足够美观、是否适合紧凑 Memory rail 或 Segment poster。
- 发现封面像截图、海报、卡片、相框、白边图或泛用素材，需要重新收敛。
- 用户只给了标题、片段内容或简短上下文，需要把它转成有审美方向的视觉提示词。

## 核心框架：四阶段方法

### 1. BEAUTIFUL：理解审美

审美标准来自高质量参考，不来自 agent 的第一反应。先从 Memory/Segment 标题、附近内容和用户意图提炼：主题、情绪、材质、光线、色彩、空间层次和视觉节奏。需要参考时，优先参考真实高质量摄影、插画、编辑视觉或产品内已有封面，而不是生成一个泛用背景。

### 2. RIGHT：适配 Reo 封面

封面是 Memory 或 Segment 的视觉身份，不是 UI 截图或装饰卡片。它必须在很小的 rail/poster 尺寸下仍然成立：主体清楚，层次明确，边缘自然延展，不能依赖可读文字、logo 或路径名。

### 3. SATISFYING：紧凑尺寸的丰富度

优秀封面在紧凑尺寸下仍有可感知的质感：明确的明暗关系、不过度均匀的背景、可识别的主体轮廓、克制但有变化的色彩。避免只用渐变、噪点、抽象线条或单一色块糊弄。

### 4. PEAK：用记忆讲故事

封面应该暗示这个 Memory 或 Segment 的独特语境。把抽象主题落到具体视觉：地点、物件、光线、材料、季节、动作痕迹或作品气质。不要把标题文字画进图里来解释主题。

## Reo 封面规则

- 图片内容必须自然铺满整个画布。不要生成画中画、内嵌边框、白边、相框、圆角矩形、卡片、海报留白、Polaroid、mockup 或任何模拟 UI 容器的外壳。
- 不要让提示词包含 `border`、`frame`、`framed`、`card`、`poster with margin`、`white background`、`polaroid`、`mockup`、`UI screenshot` 这类会诱导内嵌边框的词，除非用户明确要这种纪念物本身。
- 如果候选图里出现内部边框、白色留边、相框或卡片容器，直接判定不合格并重生成。
- 不要嵌入可读文字、logo、二维码、路径名、凭证、应用 UI chrome 或工具界面。
- 画面主体应位于中部可识别区域，但边缘也要有自然延展；Reo UI 会负责裁切、圆角和列表项外形。
- Segment poster 上方会叠加标题，下方会叠加 waveform/file icon 和 meta；不要把这些 UI 预先画进封面，也不要在图中做胶囊底、暗框或留白。
- 文件落位和恢复默认仍然按 `skills/reo-cover-image/SKILL.md` 执行。

## 提示词结构

最终提示词应包含：对象主题、情绪、视觉媒介、主体、环境、光线、材质、色彩关系、层次、full-bleed 约束和负面约束。

推荐结构：

`Full-bleed [medium] of [subject and setting], [mood], [lighting], [materials/textures], [color relationship], clear central subject, natural detail to every edge, no text, no logo, no border, no frame, no white margin, no card, no UI mockup.`

## 评估清单

- 审美质量至少达到 7/10；如果第一张只是可用但普通，继续优化提示词。
- 在 80px 左右仍能看出主体或氛围。
- 没有图片内部边框、白边、相框、卡片或 UI 容器。
- 不依赖文字解释主题。
- 色彩、光线和材质服务 Memory 或 Segment 的语义，而不是套一个通用风格。

## 输出

输出最终封面提示词或候选选择，并简短说明为什么它符合 Reo cover rules。之后使用 `skills/reo-cover-image/SKILL.md` 完成文件落位。
