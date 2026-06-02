# Segment Poster Cover Design

- Started: 2026-06-02 06:23 PDT
- Type: design
- Scope: Memory Studio 横向 Segment card poster cover、默认渐变图、on-cover 可读性、Segment cover 文件合同、Reo cover image skill

## 目标

把 Memory Studio 横向 Segment card 从纯灰度信息卡推进为 poster thumbnail 风格的封面卡，同时保证标题、waveform/file icon 和时长/大小在不同封面背景上稳定可读。

## 网络搜索结论

- 文字叠在图片上时，核心技巧是 text-protection overlay / scrim：在图片和文字之间加入遮罩、渐变、局部背景软化或其它保护层，而不是只换文字颜色。
- WCAG / W3C 的判断对象是文字与其紧邻背景的对比度。背景是图片时，可以通过加深或变淡文字背后的背景、halo/outline 或控制图片区域来满足对比度。
- Material 对图片或相机画面上的 UI 建议使用 gradient scrim 或 solid color 保证 UI 可读。
- 2025-2026 UI 趋势强调 evolved glass / liquid glass、bento/card 系统、tactile texture 和 typography as design；但 Reo 不应为了趋势牺牲 clarity。

参考：

- W3C G18: https://www.w3.org/WAI/WCAG20/Techniques/general/G18
- MDN Color contrast: https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Perceivable/Color_contrast
- Material object detection static image scrim guidance: https://m2.material.io/design/machine-learning/object-detection-static-image.html
- Smashing Magazine text over images: https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/
- Pixelmatters 2026 UI trends: https://www.pixelmatters.com/insights/7-UI-design-trends-to-watch-in-2026
- Clay glassmorphism guidance: https://clay.global/blog/glassmorphism-ui
- Creative Bloq 2026 graphic design trends: https://www.creativebloq.com/design/graphic-design/texture-warmth-and-tactile-rebellion-the-big-graphic-design-trends-for-2026

## Material 补充研究

- Apple HIG 的 material 不是单纯吸取一个主色填充底色，而是允许背景色从背景层穿透到前景层，用 blur、vibrancy、blending mode 和材料厚度建立层级。Apple 明确建议按语义和用途选择 material / vibrancy，不要按 material 看起来产生的颜色来选择；material 的效果会随系统设置、light/dark appearance 和背景变化。
- SwiftUI `Material` 文档也把 material 描述为插入在内容与背景之间的半透明层；它会 blur 背景，不是简单 opacity；foreground 通过 vibrancy 做 context-specific 的前景/背景混合以提升对比度。
- Windows Acrylic material 的模型也不是单色底：它强调透明度，区分 background acrylic / in-app acrylic，让背后的 wallpaper、窗口或 app 内容可见，用于 depth、focus 和 hierarchy。
- Reo 这次不采用封面 blur、不采用每个文本块的 pill 胶囊底，也不采用 Palette glass；封面可能来自用户自定义图片，必须保持清晰。Material 研究只用于前景文本/图标的 on-cover 颜色和局部保护层，不使用文本/图标阴影。

补充参考：

- Apple HIG Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple SwiftUI Material: https://developer.apple.com/documentation/swiftui/material
- Microsoft Acrylic material: https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic

## 取色算法研究

- Android Palette 的官方模型是从图片提取 prominent colors，并为叠加文字提供对应的 text colors；它还允许限制取色区域。这说明 Reo 不能只用整张图平均色，而应该按标题区和底部控件区分别取样。
- Material Color Utilities / HCT 的核心价值是把 hue/chroma/tone 分开，并用 tone 与 contrast 控制可读性；Reo 不应直接把背景主色当文字色，而应保留背景色相倾向、降低饱和度，再把 tone 推到可读的明/暗端。
- W3C G18 对图片背景的判断对象是文字背后的局部背景；当背景变化时，可以改变文字明度、给背景局部加深/变浅，或使用 halo 保持对比。Reo 的 Segment poster 因此需要 top title region 和 bottom control region 两套 foreground/protection token。
- Practical UI 的文本叠图建议是 overlay、gradient、shadow 或 text background。由于本次明确不使用封面 blur、文本 pill、文本阴影或图标阴影，Reo 采用“清晰封面 + 局部渐变保护色 + region-derived foreground”的组合。

当前设计稿算法：

1. 按 `object-fit: cover` 的中心裁切模型把封面抽样到小 canvas。
2. 分别采样 title region（卡片左上标题区）和 bottom region（waveform/file icon + meta 区），丢弃最亮/最暗各 10% 像素降低噪声影响。
3. 对每个 region 计算代表背景色、relative luminance 和 WCAG contrast。
4. 从背景 hue 派生低饱和 foreground：亮背景使用深色 tint，暗背景使用浅色 tint；若对比不足，回退到 Reo 中性黑/白。
5. 为每个 region 生成相反 tone 的 protection color：浅字配黑色局部保护层，深字配白色局部保护层。保护层只作用在标题、waveform/file icon 和 meta 附近，避开卡片四角；不模糊封面，不形成 pill，不使用阴影。
6. 浅色/深色模式只改变外部 page、timeline 和 hover shadow；卡片内部 foreground 仍由封面局部颜色决定。
7. 产品实现时 tone 结果应按 cover `version` 缓存；agent 替换图片后沿用现有 file truth refresh 触发重新取色。

补充参考：

- Android Palette API: https://developer.android.com/develop/ui/views/graphics/palette-colors
- Material Color Utilities: https://github.com/material-foundation/material-color-utilities
- W3C G18: https://www.w3.org/WAI/WCAG21/Techniques/general/G18
- Practical UI Ch.3 / Ch.5: contrast、transparent foreground、text on photos。

## Grill 决策

- Segment 横向卡需要 Segment 自有 cover 文件合同，而不是只从 Memory cover 派生。
- 整体审美方向是 poster thumbnail。
- 默认封面使用 `/Users/yck/Downloads/PM/技术线/reo文件区/reo的ui设计/reo渐变图` 中的渐变灯光图，进行适合 Reo 的方形裁剪和压缩。
- 之前生成的 6 张默认图气质不符合 Reo，应删除；MemoryRail 默认图和 Segment poster 默认图共用新的渐变灯光默认池。
- 用户自定义或 agent 生成的封面图片按文本内容和用户意愿创建；这个工作流同时适用于 Memory 列表项封面和 Segment poster 封面。
- 托管封面 skill 从 `reo-memory-cover` 改为 `reo-cover-image`，并覆盖 Memory 与 Segment 两类封面图片任务。
- Segment poster 卡保留当前信息结构：顶部标题，底部 waveform/file icon + 时长/大小。
- Audio Segment 和 Note Segment 使用同一套 poster cover 规则，仅通过 waveform 或 file icon 区分类型。
- Segment cover 只出现在 Memory Studio 横向 Segment card，不进入内容区、tab 或其它 surface。
- 选中态和 hover 态不加额外细边，主要通过遮罩、曝光和文字层透明度变化表达。

## 设计方向

Segment poster card 是小尺寸 poster thumbnail，不是普通图片卡、视频缩略图或玻璃标签卡。

HTML 设计稿位于 `index.html`。该稿按当前真实 `MemoryStudioSegmentCard` 结构复刻：
`136-148px` 正方形卡片、`segmentPreview` squircle、`12px` 内距、`88px`
标题宽度、`28px` More trigger、`52x32px` waveform、`28px` file icon 和卡片下方
timeline。

设计稿只保留当前选定方向：

- 封面保持清晰，不对 cover image 做 blur。
- 不给 title、waveform、file icon 或 meta 加 pill 胶囊底。
- 文本、waveform 和 file icon 直接使用 on-cover 颜色与局部轻遮罩；不加 text-shadow、drop-shadow 或整卡外阴影。
- 卡片外边缘不能出现可见描边、黑边或抗锯齿暗边；card 本体底色保持透明，cover layer 外扩 1px 覆盖圆角裁切边缘。
- hover / selected 通过轻微曝光变化、局部保护层强度和 More reveal 提供辨识度。
- HTML 展示覆盖 13 张默认模板图、audio/note、hover、selected、menu open、light/dark 和 136px compact。

视觉结构：

- 背景层：cover image 填满 `ReoCardSurface segmentPreview` 的正方形面积，继承当前 136-148px 宽度与 squircle 形态。
- 可读性层：使用保持图片清晰的 on-cover text/icon treatment。默认只包含避开四角的顶部标题局部保护、底部 waveform/meta 局部保护和不同状态的曝光/局部保护强度；不使用整体 vignette、封面 blur、文本 pill 或阴影。
- 信息层：标题使用 title region 派生的 on-cover primary；底部 waveform/file icon 和时长/大小使用 bottom region 派生的 on-cover glyph / secondary。颜色随封面局部背景变化，但限定在低饱和、可读的 Reo foreground 范围内。
- 状态层：hover 轻微改变 cover exposure 与保护层强度，并显示 More；selected 通过更明确的 scrim/exposure/文字不透明度表达，但不使用品牌红圆点、普通描边或阴影。

## 文件与同步模型

Segment cover 应复用 Memory cover 的模型：

- Segment 文件空间节点下可选 `cover/` 子目录。
- `cover/` 中按文件名排序的首个合法普通图片文件作为自定义 cover。
- 缺失、空目录、unsafe path、symlink、不支持格式或超限时使用默认渐变图。
- Projection 只返回 `source`、`filename` 和 `version`，不返回 raw path。
- Agent 直接替换 `cover/` 文件后，Reo 通过现有 file truth refresh 刷新横向 Segment card。
- Segment More 菜单增加恢复默认封面动作，行为与 Memory cover reset/restore 对齐。

## 默认资产策略

- 从 `reo渐变图` 目录生成一套 shared square default cover pool。
- 该 default pool 同时供 MemoryRail 默认 cover 和 Segment poster 默认 cover 使用。
- 默认资产应是仓库内置缩略图，不直接使用 1-2MB 原图。
- 裁剪应优先保留渐变灯光的高质感区域，并避免在顶部标题区和底部 meta 区出现过强高频噪声。

## Skill 策略

- `skills/reo-cover-image/SKILL.md` 是统一封面图片落位 skill，负责 Memory 与 Segment cover 的生成、替换、恢复默认和验证。
- `skills/reo-cover-aesthetic/SKILL.md` 继续作为审美判断入口，但文案需要从 Memory-only 改为 Reo cover image，覆盖 Memory 与 Segment。
- 默认未指定具体内容时，cover image prompt 应倾向生成 Reo 风格的渐变灯光；用户指定内容或 agent 能从文本内容提炼主题时，应基于内容和用户意愿生成更具体的封面。

## 实现结果

- Segment cover contract、Memory detail projection、`reo-attachment://.../segments/<segmentId>/cover/<filename>?v=<version>`、preload bridge、IPC handler 和 renderer reset/restore mutation 已接入。
- MemoryRail 默认封面与 Segment poster 共用 13 张内置渐变灯光默认图。
- `MemoryStudioSegmentCard` 改为 136-148px `segmentPreview` 正方形 poster card：清晰 cover、无封面 blur、无文本 pill、无文本/图标阴影、无整卡外阴影、无可见边框或品牌红点。
- Card hover 增加顶部 on-cover foreground 透明 state layer，More hover/open 使用取色 foreground 透明层，不再使用固定白色 hover 背景，因此浅色封面上的 More 状态也可见。
- on-cover tone 由 title region 和 bottom region 分别取样；自定义 cover route 只对可信 renderer/dev origin 返回 canvas 取色所需 CORS header，普通 note attachment 不返回该 header，`connect-src` 不扩大。
- Segment More 菜单新增 `恢复随机默认图片`，只在 Segment 有自定义 cover 时可用；undo 使用 Segment 自己的 restore token 和 `.reo/trash/segment-covers/`。
- 托管 skill 从 `reo-memory-cover` 收敛为 `reo-cover-image`，并保留 Reo 适配后的 `reo-cover-aesthetic`；两者都明确 Memory/Segment cover 路径和禁止图片内部边框、白边、相框、卡片或 UI 容器。
- current 真源已更新长期文件合同、IPC/protocol、flow、frontend、product 和 quality 事实。

## 验证证据

- HTML 设计稿 `index.html` 覆盖 13 张模板图、audio/note、hover、selected、menu open、light/dark 和 136px compact，并作为本次视觉基准。
- `MAIN_TEST_FILES=test/main/appProtocol.test.ts,test/main/memoryCovers.test.ts,test/main/memoryFiles.test.ts,test/main/workspaceFiles.test.ts,test/main/workspaceIpc.test.ts npm run test:main`：通过，447 tests。
- `MAIN_TEST_FILES=test/main/appProtocol.test.ts,test/main/memoryCovers.test.ts,test/main/memoryFiles.test.ts,test/main/workspaceFiles.test.ts,test/main/workspaceIpc.test.ts,test/main/workspaceContract.test.ts,test/main/workspaceBridgeSurface.test.ts npm run test:main`：修复 subagent findings 后复跑，通过，513 tests。
- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/MemoryStudioSegmentCard.test.tsx src/renderer/src/workspace/covers/coverTone.test.ts`：通过，3 files / 71 tests。
- `npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/MemoryStudioSegmentCard.test.tsx src/renderer/src/workspace/SegmentActionsMenu.test.tsx src/renderer/src/workspace/covers/coverTone.test.ts src/renderer/src/workspace/covers/memoryCoverSource.test.ts`：修复 subagent findings 后复跑，通过，5 files / 86 tests。
- `npm run typecheck:quick`：通过。
- `npm run format:check`：通过。
- `npm run lint:strict`：通过。
- `npm run test:renderer -- src/renderer/src/workspace/covers/coverTone.test.ts`：修复 lint 后复跑，通过。
- Subagent 审查：未发现 blocking；指出可见 cover `<img>` 与取色 `Image` 的 CORS 模式不一致、dark token 缺失、Segment cover file-truth refresh/reset patch 覆盖不足。已修复为可见 cover 同样 `crossOrigin="anonymous"`，补齐 dark cover token，并新增 Segment file-truth refresh 与 reset/undo cache patch tests。
- `npm run test:renderer -- src/renderer/src/workspace/MemoryStudioSegmentCard.test.tsx`：通过。
- `npm run test:renderer -- src/renderer/src/workspace/MemoryStudioSegmentCard.test.tsx src/renderer/src/workspace/SegmentActionsMenu.test.tsx src/renderer/src/workspace/covers/coverTone.test.ts src/renderer/src/workspace/covers/memoryCoverSource.test.ts`：hover 修正后复跑，通过，4 files / 20 tests。
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "refreshes a Segment poster cover"`：通过。
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "patches Segment cover reset"`：通过。
- `npm run typecheck:quick` / `npm run lint:strict` / `npm run format:check`：修复 subagent findings 后复跑，通过。
- `npm run verify:quick`：hover 修正与最终收口后通过；main 950 tests、renderer quick 48 files / 420 tests、typecheck、lint 和 format 全部通过。
