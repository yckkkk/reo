# 路线图

本文档是 Reo 第一阶段路线图的当前真源。路线图按体验主链推进，不按页面或技术层堆功能。

## 路线原则

- Reo 产品本质是多模态主题容器 + agent 转化 + 唯一作品。当前 P1-P6 是 audio + note 基础表达的 enabling phase，建立 agent 进入记忆空间工作的前提。**P1-P6 完成 ≠ Reo 完整形态。** Reo 完整形态需要产品本质长期轨道全部到位。
- 方案以表达主链为主，吸收组件工艺质量门槛，保留记忆空间信息架构边界。
- 每个阶段必须让一个真实用户流程更顺。
- 先证明用户愿意表达，再扩展整理、回顾和产品本质长期轨道。
- 组件必须过 craft 不变量门槛；未达到门槛的组件不能作为阶段完成依据，必要时先不做或留在 spec 中作为已知 gap。
- 当前阶段不实现 Reo runtime 内嵌 AI，agent 协作通过外部 Codex-class agent + 文件真源 + prompt-bridge 入口实现。
- audio 主链是多模态实现路径里复杂度最高的；note 主链证明同一 Memory / Segment / SegmentSupplement 文件空间可以承载非音频表达。audio + note 主链稳固后继续推进产品本质长期轨道，把剩余多模态 Segment 类型、widget runtime、Gallery 走马灯、prompt-bridge UI、AGENTS.md / skills 全部到位。

## P0 产品基线与结构

目标：锁定产品定位、核心实体、信息架构和 wireframe 基线。

完成标准：

- Reo 定位为本地优先的 AI-ready 记忆空间。
- 核心实体是记忆空间（Workspace）、`Memory`、`Segment`、`SegmentSupplement`。
- Home、Library、记忆空间的职责清楚。
- 记忆空间三面板结构确定。
- 记忆空间舞台与 `Memory Studio` 的关系确定。
- macOS 桌面 wireframe 基线沉淀到 `docs/current/wireframes/`。

## P1 表达主链

目标：让用户在记忆空间内低摩擦开始表达，并把录音安全沉淀为 Memory 内的 audio Segment。

范围：

- Loaded Workspace 底部 Floating Action Button Speed Dial 作为表达入口。
- 录音优先归属当前 Memory context；当前没有 Memory 时先新建 Memory 再进入录音。
- 录音表达组件完整交互：开始、权限、录音中、暂停、继续、停止、回放、替换、完成、失败、恢复。
- 录音 finalize 后形成 finalized audio Segment，并进入该 Memory 的 `Memory Studio`。
- 录音转写通过流式 ASR 写入 finalized audio Segment transcript；finalized audio Segment 和 SegmentSupplement 支持使用同一语音设置凭证生成缺失转录或手动重新生成转录。

质量门槛：

- 录音组件覆盖开始、权限、录音中、暂停、继续、停止、保存、失败、恢复和回放。
- 用户不需要先理解文件结构就能表达。
- 失败路径必须保留可恢复内容。

## P2 记忆空间管理

目标：让用户理解并管理多个记忆空间。

范围：

- AppShell sidebar 记忆空间列表承担记忆空间创建、打开、切换和移除。
- 已导入记忆空间通过 main-owned registry 跨 app restart 保留。
- 创建、打开现有记忆空间，或把空文件夹原地初始化为记忆空间。
- Library 的真实职责定义；当前是占位入口，不承载记忆空间管理。

质量门槛：

- 记忆空间管理是空间管理，不是文件浏览器。
- Home、Library、记忆空间的导航关系清楚。
- 记忆空间列表只是 registry 投影，记忆空间内容真源仍是记忆空间文件。

## P3 记忆空间舞台与 Memory Studio

目标：让记忆空间像一个可行动的表达空间，而不是文件目录。

范围：

- 记忆空间三面板 shell：左侧 AppShell sidebar、中间 Workspace Stage 或 Memory Studio、右侧可折叠 MemoryRail。
- 右侧 MemoryRail 展示当前 Workspace 的 Memory 容器列表，用于在 Memory 之间切换。
- 中间未选中 Memory 时是 Workspace Stage 表达舞台；选中 Memory 后进入 `Memory Studio`。
- `Memory Studio` 支持 Segment 横向预览流、时间轴、本地回放、已保存 transcript、Markdown 笔记正文、SegmentSupplement 补充录音和笔记补充。

质量门槛：

- 中间面板承担主要体验。
- `Memory Studio` 是首屏可理解的 studio surface，不靠页面纵向滚动看完整主体验。
- 右侧 rail 不展示伪聊天、假输出或未实现能力。

## P4 Move Memory

目标：让用户把整条 memory 归入目标记忆空间。

范围：

- 从来源记忆空间选择整条 memory。
- 选择目标记忆空间。
- 执行整条 memory 移动。
- 移动后进入目标记忆空间的 Memory Studio。

质量门槛：

- 第一阶段只移动整条 memory。
- 不支持单个 segment 跨记忆空间拆分移动。
- 用户交互表现为“归入记忆空间”，不暴露事务状态。
- 文件移动必须有明确失败保留和恢复路径。

## P5 Review 与 SRS 基础

目标：让用户选择性地重温 memory，并看到轻量记忆程度。

范围：

- Memory Studio 中加入 review opt-in。
- 轻量记忆程度展示。
- 下次重温时间。
- 复述与回看嵌入模块。
- Home 和记忆空间舞台的今日重温摘要。

质量门槛：

- Review 是可选能力，不是核心实体。
- 不把 Reo 收窄为学习软件。
- 不引入复杂算法或复杂状态机。
- 复述和回看入口必须鼓励表达，而不是只做被动浏览。

## P6 AI-ready 验证

目标：证明 Reo 记忆空间可以被外部 Codex-class agent 清楚读取和协作，包括用户主动触发和外部 scheduled 任务（Codex CLI / Claude Code 自带能力）读写。

范围：

- 记忆空间 root 的 `AGENTS.md` 描述记忆空间目的、结构和协作规则；Workspace root 的 `users.md` 描述用户个人 context。
- Memory、Segment、SegmentSupplement 文件结构清楚。
- Codex CLI 可以进入记忆空间读取、解释和整理当前文件。
- 外部 scheduled agent 任务（Codex CLI 内置定时 / Claude Code background tasks / 用户自配 cron）写回的新内容（reminder、教学 HTML、补充建议）能被 Reo 正确识别和投影。
- 验证不依赖 Reo runtime 内嵌 AI；也不依赖 Reo 自己实现 schedule（AI 公司已提供）。

质量门槛：

- 不实现内嵌 AI chat、agent runtime、tool use 或自动整理。
- 不展示假 AI 功能。
- 不重复实现 AI 公司已有的 scheduled task 能力。
- Codex CLI 验证只读边界、写入边界、scheduled 写回投影一致性和用户文件真源。

## 产品本质长期轨道

P0-P6 是 audio + note 基础表达的 enabling phase。Reo 的产品本质长期轨道在基础表达主链稳固后启动独立 active initiative，不与当前 active initiative 并行。本节列出该轨道范围，作为对齐入口；不作为当前 session 推进对象。

**Reo 的完整产品形态需要本轨道全部条目到位。** 这些不是"长期方向"，是 Reo 真正成为 Reo 的必经路径。

范围条目按优先级排列：

- **多模态 Segment / SegmentSupplement 类型（核心必经）**：继续实现 `video`、`photo`、`imported_file` 与 `html` Segment 类型及对应 SegmentSupplement，并把 Memory Studio、Segment 卡片、播放 / 浏览 / 编辑区扩展到跨模态。`note` 当前已具备 markdown-first create/edit、图片附件和外部编辑冲突基础；Live Preview 编辑器深化仍需独立 research/spec。这是 Reo "围绕一件事的所有材料"承诺成立的前提；缺这层 Reo 只是录音 + 笔记工具。每个新类型必须先有文件合同、IPC contract、查询更新、恢复路径、craft 门槛验证。
- **回顾 mechanics（粘性核心）**：结合记忆曲线 + 随机推送式回顾节奏 + 桌面入口提示。Flomo 已证明回顾机制是 prosumer 用户长期回来的根本原因；Reo 用 Gallery 走马灯 + 回顾 skills + widget 形态实现，做成跨模态沉浸式回顾而非碎片推送。
- **AGENTS.md + users.md 模板与 skills 目录**：记忆空间 root 与 Memory root 的 `AGENTS.md` 模板由 Reo 出厂提供；Workspace root 的 `users.md` 模板由 Reo 出厂 + 首次启动引导用户填写，承担"用户是谁 / 长期目标 / 偏好"的个人 context 层。默认 skills 分两层：原子 skill 共 8 项（引导 / 回顾 / 整理总结 / widget 生成 + 默认洞察 / 价值澄清 / 二阶思考 / 逆向思考），use-xxx 组合 skill 共 3 项（`use-学习闭环` / `use-记忆回顾循环` / `use-内容创作支援`）。skill 组合是 agent 责任，不是用户责任。skills 是 Reo 对外差异化的核心承担物——Flomo 付费 AI 视角在 Reo 都是 skills 自定义免费。
- **Prompt-bridge UI**：Workspace、Memory、Segment、SegmentSupplement、Widget 的 Entity More 菜单上统一 `agent 操作 ▸` 子菜单，prompt 复制到剪贴板。结构允许未来 agent 内嵌时无重构演化。
- **Widget runtime**：Workspace-level widget（Home 区域、Gallery 走马灯）与 Memory-level widget（Memory rail tab）的对象合同、manifest、渲染沙箱、craft 门槛实现。日历 / 时间线 widget 作为 Day 1 示例；成长册、关系曲线、概念时间线等跨模态 widget 作为完整形态示例。
- **Gallery**：Workspace 级别独立页面，与 Home / Loaded Workspace 同级。Gallery 内部走马灯艺术 tab + 列表 tab；走马灯艺术 tab 跨模态混合呈现（录音 + 视频 + 照片节奏感切换），是 craft 不变量的核心承担页之一。
- **HTML Segment / SegmentSupplement 渲染**：agent 生成的 HTML 报告 / 作品页 / 复盘文档作为 `html` 类型落到现有文件合同；渲染必须先实现隔离预览能力。

实施时序与完成门槛由该轨道启动时的 initiative 与 spec 定义。本路线图只确立轨道存在和范围。

产品本质长期决策见 `docs/decisions/0006-agent-native-carrier-and-generative-ui.md`，外向定位叙事与用户场景见 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/positioning.md`，竞品对比与差异化叙事见 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/competitive-analysis.md`。

## 长期方向

下列方向在产品本质长期轨道之外，进入主线前需要独立判断和 spec。注意：剩余多模态 Segment 类型（video / photo / imported_file / html）已提升到产品本质长期轨道，**不在本节**。

- 草稿记忆空间：Home 入口的低摩擦录制设计（draft memory space / inbox 录制入口），让用户在未选定记忆空间时也能先表达、后归入。
- 笔记 Live Preview editor 深化：以 CodeMirror 6 为首选底座，先验证 `codemirror-markdown-hybrid` 或 Reo-owned equivalent；目标是 Markdown 源码真源、光标所在行或块 raw Markdown、其它区域渲染预览。BlockNote 和 Tiptap 不作为当前目标。
- 单个 Segment 级跨记忆空间移动。
- 更完整的 SRS。
- Reo runtime 内嵌 AI agent（取代 prompt-bridge 外部 agent 协作）。
- 数据库、auth、同步、分享和发布能力。
