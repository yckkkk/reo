---
name: reo-cover-image
description: 用于 Reo 记忆空间中的 Memory 或 Segment 封面生成、替换、默认模板切换、恢复默认和刷新验证。
---

# Reo Cover Image

用于 Reo 封面图片任务。工作目录应是当前记忆空间 root。

## 快速开始

1. 如果用户给了明确对象目录或 manifest 路径，直接使用该路径。
2. 自定义封面：把最终图片写入目标对象自己的 `cover/` 目录。
3. 默认模板：只写对应对象 manifest 的 `defaultCoverTemplateId`。
4. 直接验证文件效果，然后停止。Reo 负责 snapshot refresh 和投影。

需要先判断或提升封面审美时，使用 `skills/reo-cover-aesthetic/SKILL.md`。

## 目标路径

- Memory 封面：`memories/<memory-directory>/cover/`。
- Segment 封面：`memories/<memory-directory>/segments/<segment-directory>/cover/`。
- Memory 默认模板 manifest：`.reo/objects/memories/<memoryId>.json`。
- Segment 默认模板 manifest：`.reo/objects/segments/<segmentId>.json`。
- 如果用户说“列表项”“记忆封面”“Memory rail”，通常是 Memory 封面。
- 如果用户说“片段”“横向片段”“Segment poster”，通常是 Segment 封面。

## 替换或创建自定义封面

- 如果目标 `cover/` 不存在，创建普通目录。
- 把选定封面图片放入该目录。当前合法格式是 PNG、JPEG 和 WebP。
- Reo 使用 `cover/` 中按文件名排序的第一个合法普通图片文件；如果用户只期望一个封面，使用 `cover.png` 这类稳定文件名，或移除旧候选图。
- 不要创建 symlink、嵌套 cover 目录、隐藏临时文件或不支持的格式。
- 自定义封面任务不要编辑 `.reo/index.json`、manifest、lock、`.reo/trash` 或协议 URL。Reo 会重新计算 cover projection。

## 生成封面

- 使用可用的图片生成工具或用户提供的提示词生成位图封面。
- 生成图像应让画面内容自然铺满整个画布，主体在紧凑尺寸下仍可辨认，边缘被 UI 裁切时也不影响主题。
- Segment poster 封面上会叠加标题、waveform/file icon 和 meta；图片仍应清晰铺满，不要在图中预留文字胶囊、按钮、暗框或空白 UI 区。
- 不要在图片内部绘制边框、白边、相框、卡片、圆角容器、海报留白或模拟 Memory rail 的外壳；Reo 界面会自己裁切和加圆角。
- 避免嵌入文字、logo、二维码、UI chrome、路径名、凭证，或任何用户没有要求纪念的内容。
- 如果生成多个候选，除非用户明确要求保留变体，只把最终选定图片放入 `cover/`。

## 切换随机默认图片

- 用户要求通过 Reo app 操作时，使用对应对象 More 菜单项 `切换随机默认图片`。
- 用户要求文件操作或给出 manifest 路径时，读取目标对象 manifest，把顶层 `defaultCoverTemplateId` 改成 `cover-01` 到 `cover-13` 中的目标值，然后验证 JSON 仍可解析。
- 如果用户已经给出 manifest 路径，只改那个文件、那个字段。
- 不写图片文件，不要编辑 `.reo/index.json`。自定义 `cover/` 仍会优先展示。

## 恢复默认封面

- 用户要求通过 Reo app 操作时，使用对应对象 More 菜单项 `恢复随机默认图片`。
- 纯文件操作时，只有用户明确要求恢复默认封面，才移除或移动目标对象自己的 `cover/` 目录。
- 不要写入默认封面文件。默认封面内置在 Reo，不存放在记忆空间内。

## 验证

- 自定义封面：确认 `cover/` 是普通目录，首个合法图片是普通 PNG、JPEG 或 WebP，且没有 symlink。
- 默认模板：确认目标 manifest JSON 可解析，`defaultCoverTemplateId` 是目标模板 id。
- 如果 Reo 正在打开该记忆空间，等待文件真源刷新；不要编辑 `.reo/index.json` 强制刷新。
