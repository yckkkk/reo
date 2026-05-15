# 路线图

本文档是 Reo 第一阶段路线图的当前真源。路线图按体验主链推进，不按页面或技术层堆功能。

## 路线原则

- 方案以表达主链为主，吸收组件工艺质量门槛，保留记忆空间信息架构边界。
- 每个阶段必须让一个真实用户流程更顺。
- 先证明用户愿意表达，再扩展整理、重温和 AI runtime。
- 组件必须满足表达主链的体验标准；未达到体验标准的组件不能作为阶段完成依据。
- 第一阶段不实现 AI runtime，只做 AI-ready 文件结构和 Codex CLI 验证。

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
- 录音转写通过流式 ASR 写入 finalized audio Segment 的 transcript。

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
- `Memory Studio` 支持 Segment 横向预览流、时间轴、本地回放、已保存 transcript 和 SegmentSupplement 补充录音。

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

目标：证明 Reo 记忆空间可以被外部 AI 清楚读取和协作。

范围：

- 记忆空间 root 的 `AGENTS.md` 描述记忆空间目的、结构和协作规则。
- Memory、Segment、SegmentSupplement 文件结构清楚。
- Codex CLI 可以进入记忆空间读取、解释和整理当前文件。
- 验证不依赖 Reo runtime 内 AI。

质量门槛：

- 不实现 AI chat、agent runtime、tool use 或自动整理。
- 不展示假 AI 功能。
- Codex CLI 验证只读边界、写入边界和用户文件真源。

## 后续方向

后续方向必须在第一阶段主链稳定后再进入：

- 草稿记忆空间：Home 入口的低摩擦录制设计（draft memory space / inbox 录制入口），让用户在未选定记忆空间时也能先表达、后归入。延期能力，第一阶段不设计。
- 视频 Segment。
- 图片 Segment。
- 笔记 Segment 和 editor 深化。
- 单个 Segment 级移动。
- 更完整的 SRS。
- Reo runtime 内 AI agent。
- 数据库、auth、同步、分享和发布能力。
