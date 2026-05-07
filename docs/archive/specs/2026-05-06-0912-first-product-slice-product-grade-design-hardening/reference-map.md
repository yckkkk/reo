# Reference Map

## 参考素材

必须参考的 6 张图：

1. `/Users/yck/Downloads/PM/设计参考/记忆录音/ Reflections详细弹层.jpg`
2. `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-录音中弹层.png`
3. `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-没有录音弹层.png`
4. `/Users/yck/Downloads/PM/设计参考/记忆录音/home页面-sidebar rail态.png`
5. `/Users/yck/Downloads/PM/设计参考/记忆录音/home页面-sidebar展开态.png`
6. `/Users/yck/Downloads/PM/设计参考/记忆录音/workspace页面.png`

辅助帧：`/private/tmp/reo-reference-frames/`。

辅助帧执行边界：

- `ref1-02.jpg` 到 `ref1-13.jpg`、`ref1-contact.jpg`：用于核对 reflections drawer、inline entity highlight、suggestion popover、联系人/实体 future wireframe 和 drawer micro-interaction。当前实现范围只落地 drawer/editor/autosave；联系人资料和实体图谱只做 wireframe。
- `ref2-01.jpg` 到 `ref2-27.jpg`、`ref2-contact.jpg`：用于核对 recording drawer idle/acquiring/recording/paused/stopping、waveform、controls、playback/editor transition 和辅助 contact/entity micro-interaction。当前实现范围只落地录音、播放、transcript/reflections 编辑；contact/entity 自动能力只做 wireframe。
- QA 必须把 6 张主图作为结构对照，把 41 张辅助帧作为状态和 micro-interaction 清单。若某一帧展示未实现能力，verification 必须记录为 wireframe-only，不得在 current build 渲染为可点击功能。

## 当前实现差距

| 区域       | 当前实现                                       | 差距                                                                                          | 结论 |
| ---------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- |
| 创建工作区 | 居中窄表单                                     | 没有产品级 first-run shell、最近工作区、open/import 分支、路径风险和冲突恢复                  | 阻断 |
| 首页       | 居中标题 + Record button + Memory Content 列表 | 没有 covered/expanded/resizing layered sidebar、搜索/过滤、时间分组、卡片层级、工作区详情入口 | 阻断 |
| 工作区详情 | 未实现                                         | 参考图中的 memory title、date、action strip、content sections 没有设计落地                    | 阻断 |
| 录音弹层   | Radix Dialog + 文本状态 + buttons              | 缺少大型 bottom drawer、实时波形、录音中转写视觉、空录音视觉、icon controls                   | 阻断 |
| 录音后编辑 | textarea transcript/reflections                | 缺少 reference 中 reflection editor、inline suggestion、autosave 状态、播放控件               | 阻断 |
| 开源复用   | 自研轻量 bars，Vaul/wavesurfer deferred        | 没有按 ElevenLabs UI、shadcn Drawer/Vaul、wavesurfer 做优先复用                               | 阻断 |

## 逐图映射

### Reflections 详细弹层

必须吸收：

- 背景保留当前 app shell，但 blur/dim 表示 modal/drawer 上下文。
- bottom drawer 占据下半屏到大半屏，有 handle、圆角顶部、white/card surface。
- 标题区为 `Write about your memory`。
- 主编辑区域为 `Additional Reflections`，内容是长文本编辑器，不是普通窄 textarea。
- 文内实体 highlight 支持不同类型，例如 place、person、family/group。
- suggestion popover 锚定到实体，包含标题、说明、`Skip` 和 `Add as a person`。

Reo high-fidelity 采用：

- 当前范围：录音后 `Reflections` drawer、长文本编辑、autosave status、entity suggestion wireframe。
- 当前不实现：自动实体抽取、联系人资料创建、跨 memory graph。它们必须以 wireframe/gated copy 标明，不进入当前可点击功能。
- Reo token：不使用粉色大面积按钮。主按钮用 Obsidian filled pill；实体 highlight 用低饱和 token 和 underline/outline，不靠颜色唯一表达。

### 录音中弹层

必须吸收：

- bottom drawer 高度接近视口 65%-75%。
- 中央标题 `Record Audio`。
- 上方 live waveform 横跨主要内容宽度。
- 中部实时转写/当前句视觉，文字居中并逐行淡出。
- 底部控制为 stop、timer + listening state、pause。

Reo high-fidelity 采用：

- 当前范围：live recording drawer、waveform、elapsed timer、state label、stop/pause controls。
- 若没有真实 STT，实时转写区域必须显示 `手写草稿将在停止后编辑` 或 hidden idle copy，不能显示 mock transcript。
- 若后续实现本地/云 STT，必须先新增 STT foundation，不得把 mock 文案伪装成能力。

### 无录音弹层

必须吸收：

- 同一个 bottom drawer shell。
- idle waveform baseline。
- 大型 record action 视觉突出。
- `Cancel` 在 record action 下方。

Reo high-fidelity 采用：

- 当前范围：idle、acquiring permission、permission denied、recording failed、cancel。
- 大 record button 使用 lucide `Mic` 或 `Circle` 组合，不用 emoji；视觉尺寸 >= 64px，点击目标 >= 48px。
- `Cancel` 是 secondary/tertiary action，不与 record 主操作竞争。

### Home sidebar covered 态

必须吸收：

- 左侧 sidebar 作为 app shell 底层常驻结构，最小宽度 240px，最大宽度 520px。
- 主内容面板作为上层悬浮面板覆盖 sidebar，四周 8px inset、12px radius。
- macOS window controls 悬浮在 sidebar 图层左上角之上。
- 折叠时主内容面板覆盖 sidebar，而不是把 sidebar 推出视野。
- 主区有 `All memories`、说明、filter、search、create action。
- 内容按年月分组，横向卡片滚动/网格。

Reo high-fidelity 采用：

- 当前范围：covered/expanded layered shell、Home selected、New Memory/Record entry、workspace home summary、recording cards。
- 旧 72px rail 概念不进入 current build；covered 状态只体现主内容面板覆盖 sidebar 的分层行为。
- 参考图中的 photo/film 文案必须改成当前真实能力：voice/text memories。不能展示 photo/video/film 可用能力。
- Search/filter 在当前实现范围只允许作为 Home 本地 snapshot search/filter；若 implementation plan 不实现真实 query/filter consumer，则 current build 不渲染可点击筛选。

### Home sidebar 展开态

必须吸收：

- 展开 sidebar 有 brand、nav item label、section groups、bottom account/workspace identity。
- covered/expanded 可以切换，但不改变 route；主内容 hierarchy 保持为上层悬浮面板。
- Sidebar 可拖拽 resize，宽度 clamp 到 240-520px。

Reo high-fidelity 采用：

- 当前范围：sidebar covered/expanded/resizing 状态、Home、New memory、Home 本地 Search；collections wireframe。
- `Films` 在当前实现不能作为可用 nav。只能在 future wireframe 中显示为 gated/grey structural item，implementation 不显示。
- Bottom identity 当前使用 local workspace identity，不引入 auth UI，直到 Better Auth slice。

### Workspace 页面

必须吸收：

- 详情页 centered title、date、action strip。
- Action strip 有 AI/summary、camera、mic、pen、add、more 等 icon-only controls。
- Sections 使用大写 label + hairline divider + show more。
- Cards 有 queued/cooking/playable/duration 状态。

Reo high-fidelity 采用：

- 当前范围：memory detail for voice/text，title/date/action strip、record microphone、write/reflection edit。
- `More` 只作为 future wireframe，除非 implementation plan 明确只读菜单项、IPC、安全、错误恢复和测试。没有这些合同前，current build 不渲染可点击 `More`。
- More wireframe items：rename、delete、show in folder、export；这些都是 future-only。
- `Films`、camera/photo、video/film card 是 future wireframe，不进入当前 build。
- 当前真实 sections：`Voice recordings`、`Transcript`、`Reflections`、`Memory content`。Future wireframe 才显示 `Films`。

## 必须从参考图保留的交互结构

- App shell 常驻 sidebar。
- Large bottom drawer 作为录音和反思编辑的 primary overlay。
- 录音状态以 waveform + controls + timer 为中心，而不是文字状态列表。
- Memory/workspace content 使用 section header + divider + cards。
- 详情页 action strip 使用 lucide icon-only controls，并有 tooltip/accessible name。
- 创建或新增 memory 不从一个孤立按钮开始，而是在 app shell 内进入清晰流程。

## 必须按 Reo 设计系统替换的视觉

- 参考图的粉色 brand/primary 替换为 Reo Obsidian filled action；Signal Blue/Ember 只做小状态点。
- 插画贴纸卡片替换为 Reo product card、audio waveform 或 file-type glyph；不做玩具化 sticker。
- 大范围 blur 只服务 overlay context，不作为装饰。
- 文案全部改成 Reo 当前能力，不出现未实现 photo/video/film 文案。
