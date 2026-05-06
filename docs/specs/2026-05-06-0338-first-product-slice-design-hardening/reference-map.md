# 参考素材映射

## 证据输入

已核对的本地参考素材：

- `/Users/yck/Downloads/PM/设计参考/记忆录音/1参考.mp4`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/2参考micro interactions..mp4`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/Drawer with ElevenLabs audio component.mp4`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/*.jpg`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/*.png`
- `/private/tmp/reo-reference-frames/*.jpg`

为审查生成的派生证据：

- `/private/tmp/reo-design-hardening-frames/reference-contact.jpg`，shasum `de90418657591f0715e8ae7a8b99553afbfe87e7`
- `/private/tmp/reo-design-hardening-frames/drawer-contact.jpg`，shasum `8b0e67c911a06cf741185369c9f16d162f2e43dd`
- `/private/tmp/reo-design-hardening-frames/drawer-01.jpg` 到 `drawer-08.jpg`

视频 metadata：

| 素材                                         | 时长     | 主 stream               | 备注                              |
| -------------------------------------------- | -------- | ----------------------- | --------------------------------- |
| `Drawer with ElevenLabs audio component.mp4` | 18.899 s | h264 3324 x 2160 30 fps | bottom sheet recording overlay    |
| `1参考.mp4`                                  | 13.199 s | h264 3324 x 2160 30 fps | memory page and action controls   |
| `2参考micro interactions..mp4`               | 27.466 s | h264 3324 x 2160 30 fps | action hover and page transitions |

参考帧尺寸：

- `/private/tmp/reo-reference-frames/ref1-*.jpg`：1200 x 780
- `/private/tmp/reo-reference-frames/ref2-*.jpg`：1200 x 780
- contact sheets：`ref1-contact.jpg` 2140 x 1412，`ref2-contact.jpg` 2604 x 1437

## 逐帧证据

| 证据                                                     | hash                                       | 观察                                                 | Reo 采纳                                        | Reo 拒绝                                | 验证                        |
| -------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------- | --------------------------------------- | --------------------------- |
| `/private/tmp/reo-reference-frames/ref1-02.jpg`          | `bc50fab08b9fc13f79ed043aa6cff15324e62f9f` | centered memory title，顶部留白，日期/辅助信息弱化   | Workspace home header 使用居中标题和辅助信息    | reference palette 和 decorative spacing | viewport + long title tests |
| `/private/tmp/reo-reference-frames/ref1-05.jpg`          | `3efc157394d1abf2db6877aac7c48b0f85f1cd21` | title 下方 compact action row，多个媒体入口并列      | action row 压缩为唯一 implemented record action | film/photo/video/file/link controls     | absence tests               |
| `/private/tmp/reo-reference-frames/ref1-10.jpg`          | `4ed88f8ef62d8d1c6403f3dd43a10804d6e9e205` | content cards 在主标题之后形成内容层                 | `Memory Content` 下展示 recording cards         | card 作为装饰或 future type placeholder | renderer card tests         |
| `/private/tmp/reo-reference-frames/ref2-01.jpg`          | `d574cbc0d1cb31339ad12b2ed1b2d3ce2e0573f1` | optional left navigation 和 grouped memory list      | 仅作为 future sidebar 输入                      | first slice full sidebar                | sidebar non-goal inspection |
| `/private/tmp/reo-reference-frames/ref2-15.jpg`          | `527bb997e54807a40b3fc6c2ef0815e65564c9f2` | grouped cards 适合扫描已有 memories                  | recording card grid 采用 compact density        | Photos、Videos、Places 等未实现 group   | UI absence tests            |
| `/private/tmp/reo-design-hardening-frames/drawer-01.jpg` | `6ee0fee61e5b5e3ed9291de2a5cb245da262b903` | workspace 背景可见，bottom sheet 从底部进入          | overlay 保留 workspace context                  | 只靠 blur 表示 modality                 | Dialog focus tests          |
| `/private/tmp/reo-design-hardening-frames/drawer-03.jpg` | `d275f362d814574ac416d705f044f49393f1b653` | 大 white panel、标题、waveform 和主 control 清晰     | Recording overlay hierarchy                     | pink CTA 和 novelty scale               | reference visual inspection |
| `/private/tmp/reo-design-hardening-frames/drawer-05.jpg` | `853c1fea26cbbb74256db8f3a20b866f41b47f4a` | waveform/progress 位于 transcript 前，说明状态优先级 | waveform/status/text stack                      | 复制 ElevenLabs palette 或 agent copy   | component state tests       |
| `/private/tmp/reo-design-hardening-frames/drawer-08.jpg` | `4423fb2bc737cb981b7c3c6c615f4de365571ea3` | overlay 内有可滚动文本和底部 controls                | internal scroll + sticky controls               | controls 被长文本挤出可达区域           | 900 x 620 viewport evidence |

## 映射表

| 参考素材                                     | 观察到的结构                                                                                    | Reo 映射                                                           | 采纳                                                                  | 拒绝                                                  | 验证                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `ref1-*` birthday page                       | centered title/date、compact action row、content cards below                                    | Workspace home header、one record action、`Memory Content` section | hierarchy、centered title、card grid                                  | film/photo/video/file buttons、pink action color      | renderer absence tests and viewport checks |
| `ref2-*` all memories                        | optional left navigation and grouped memory cards                                               | Future sidebar input only；first slice uses top header             | content grouping and compact card density                             | sidebar with unimplemented sections                   | sidebar decision in `ui-blueprint.md`      |
| `Drawer with ElevenLabs audio component.mp4` | blurred page background、large bottom sheet、record button、waveform、transcript text、controls | Recording overlay with Dialog semantics and bottom sheet placement | modal focus、bottom sheet hierarchy、waveform/status/transcript stack | visual palette、oversized novelty CTA、future effects | Computer Use overlay validation            |
| `3e163...png` high-res drawer                | large white bottom panel with recording title and waveform                                      | Reo panel surface with Card White and Reo focus treatment          | sheet geometry and state prominence                                   | reference font/color/tooltip style                    | reference-map evidence                     |
| ElevenLabs UI docs                           | audio/agent components are open-code registry                                                   | evaluate per component，never `add all`                            | source ownership and component concepts                               | network/token-dependent agent components              | reuse decisions table                      |

## 采纳结构

- Recording overlay 打开时保留 workspace 背景，让用户知道仍在同一个 workspace 内。
- Overlay 只表达一个明确主状态：recording、paused、stopping、editing 或 playback。
- Transcript 与 audio controls 同层级展示，不藏进独立 detail page。
- Recording entry cards 是内容对象，不是 landing page 装饰卡。

## 视觉替换规则

| 参考视觉                     | Reo 替换规则                                                |
| ---------------------------- | ----------------------------------------------------------- |
| 粉色/红色 primary action     | Obsidian primary button 或小型 Signal Blue/Ember status dot |
| 圆润 novelty CTA bubbles     | Reo pill buttons for commands 和 compact icon buttons       |
| 装饰性 heavy blur/dim        | 最小 modality dim/blur，并由 Dialog semantics 支撑          |
| 含未来类型的 card-heavy grid | 只显示已实现 entry 的 recording cards                       |
| 参考字体                     | Waldenburg for 32 px headings，Inter for UI/body            |
| 装饰性 icons                 | 需要时使用 lucide，否则使用文字/status dots                 |

## 保留的微交互

- Action hover 显示确切 command affordance。
- Bottom sheet 从底部打开并 return focus。
- Record state 变为 active 时有明确状态变化。
- Waveform 在 recording 时移动，paused 时停止。
- Transcript draft 渐进出现，但必须标记为本地草稿提示，不得暗示真实 speech-to-text。
- Stop 在 disk finalize 后进入 editing，不能提前假装保存完成。

## 明确不采纳

- 不显示 Films section。
- 不显示 camera、upload、link、photo、video、file 或 generic add controls。
- 不使用 emoji。
- 不复制 pink palette。
- 至少两个已实现 section 出现前不显示 full sidebar。
