# 可访问性矩阵

## 页面与状态

| 界面                  | 语义                           | 名称                         | 键盘路径                                  | 焦点行为                                         | 公告行为                           | 减弱动效处理              | 点击目标/对比度                         | 测试证据             |
| --------------------- | ------------------------------ | ---------------------------- | ----------------------------------------- | ------------------------------------------------ | ---------------------------------- | ------------------------- | --------------------------------------- | -------------------- |
| Workspace 管理        | `main` + form                  | 创建 memory workspace        | title、description、choose folder、submit | 初始焦点在 title                                 | 字段错误被公告                     | 无动画依赖                | controls >= 40 px；Obsidian/Chalk focus | RTL 表单测试         |
| 文件夹选择器          | button + status text           | 选择 workspace folder        | Enter/Space 打开 OS dialog                | 取消后回到 button                                | selected folder 用 status text     | 无动画                    | 可见焦点                                | Computer Use         |
| 已有 `AGENTS.md` 冲突 | `role="alert"` 或 alert region | Reo 不会覆盖 `AGENTS.md`     | submit 后可达                             | 焦点进入错误摘要                                 | assertive                          | 无动画                    | Gravel/Obsidian 对比度                  | renderer 错误测试    |
| Workspace 缺失        | status/alert                   | Workspace folder missing     | recovery actions 可达                     | 焦点进入第一个 recovery action                   | 阻断状态用 assertive               | 无动画                    | action labels 可见                      | renderer 状态测试    |
| Workspace 首页        | `main` + region                | Memory Content               | record action、cards                      | 焦点保持在当前 control                           | loading 用 status                  | 不依赖 transform          | card focus 可见                         | viewport + RTL       |
| 录音入口              | button                         | 开始录音                     | Enter/Space                               | 可见焦点                                         | 不额外打扰                         | active motion 可关        | 40 px minimum                           | accessible name 测试 |
| 录音卡片              | button/link-like card          | recording title              | Enter 打开 overlay                        | 关闭后返回                                       | 无                                 | 禁止只在 hover 展示信息   | focus ring 可见                         | card 测试            |
| 录音 overlay          | labelled `dialog`              | Recording title              | tab trapped                               | deterministic initial focus，关闭后 return focus | dialog semantics                   | 关闭 open/close transform | panel 对比度                            | Dialog 测试          |
| 录音控制              | buttons                        | 暂停录音、继续录音、停止录音 | Enter/Space                               | disabled/busy 不形成陷阱                         | busy state status                  | waveform static fallback  | 40 px controls                          | RTL 控制测试         |
| 波形/进度             | visual + text status           | Recording progress           | first slice 不单独 focus                  | 不抢焦点                                         | text status backup                 | static bars               | 不作为唯一状态线索                      | visual + state 测试  |
| 录音中草稿            | region                         | 本地草稿提示                 | long text 可滚动                          | append 不抢焦点                                  | 不 assertive                       | reveal 可关闭             | readable line height                    | long text 测试       |
| 播放面板              | group                          | Recording playback           | play/pause                                | 焦点留在 control                                 | loading/error status               | 无动画依赖                | labels 可见                             | playback 测试        |
| Transcript 编辑器     | textarea + label               | Transcript                   | label focus、edit、retry                  | autosave 不抢焦点                                | saving/saved polite，failure alert | 无动画                    | 0 radius input + visible focus          | autosave 测试        |
| Reflections 编辑器    | textarea + label               | Reflections                  | label focus、edit、retry                  | 独立于 transcript                                | independent status                 | 无动画                    | 同 transcript                           | autosave 测试        |
| 待确认关闭            | dialog/alert                   | Unsaved changes              | close/cancel/retry 可达                   | 焦点进入第一个安全 action                        | assertive                          | 无动画                    | buttons clear                           | close-state 测试     |

## 图标规则

- UI 不使用 emoji。
- Icon-only controls 必须使用 lucide icon、`aria-label` 和 visible focus。
- Tooltip 只是补充；accessible name 由 hidden text 或 `aria-label` 承担。
- 若没有明确 lucide 图标，使用可见文字。

## 键盘场景

| 场景                          | 期望行为                                              | 测试                    |
| ----------------------------- | ----------------------------------------------------- | ----------------------- |
| 只用键盘创建 workspace        | 用户能输入 title、选择 folder、submit、读错误。       | renderer + Computer Use |
| OS dialog cancel              | focus 回到 folder picker，form values 保留。          | operation validation    |
| 从 record action 打开 overlay | focus 进入 dialog，关闭后返回 opener。                | Dialog test             |
| Recording active controls     | pause/resume/stop 可达；repeated stop disabled/busy。 | RTL                     |
| Save failure                  | error announced，retry 可达，edited text 不丢。       | RTL                     |
| 900 x 620                     | focus target 不被 clipping 或 sticky controls 遮挡。  | viewport evidence       |
