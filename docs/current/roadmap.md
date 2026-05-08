# 路线图

本文档是 Reo 第一阶段路线图的当前真源。路线图按体验主链推进，不按页面或技术层堆功能。

## 路线原则

- 方案以表达主链为主，吸收组件工艺质量门槛，保留记忆空间信息架构边界。
- 每个阶段必须让一个真实用户流程更顺。
- 先证明用户愿意表达，再扩展整理、重温和 AI runtime。
- 现有组件只作为半成品基础，不能降低最终体验标准。
- 第一阶段不实现 AI runtime，只做 AI-ready 文件结构和 Codex CLI 验证。

## P0 产品基线与结构

目标：锁定产品定位、核心实体、信息架构和 wireframe 基线。

完成标准：

- Reo 定位为本地优先的 AI-ready 记忆空间。
- 核心实体只有记忆空间、`Memory`、`Asset`、`Review`。
- Home、Library、记忆空间、草稿记忆空间的职责清楚。
- 记忆空间三面板结构确定。
- 记忆空间舞台、`Memory Studio`、`Guided Recall` 的关系确定。
- macOS 桌面 wireframe 基线沉淀到 `docs/current/wireframes/`。

## P1 表达主链

目标：让用户从 Home 低摩擦开始表达，并把内容安全保存为草稿 memory。

范围：

- Home dashboard 的即时表达入口。
- 草稿记忆空间作为默认保存目标。
- 录音表达组件完整交互。
- 录音保存后形成 memory 和 audio asset。
- 保存后进入 Memory Studio 或明确的草稿结果状态。

质量门槛：

- 录音组件覆盖开始、权限、录音中、暂停、继续、停止、保存、失败、恢复和回放。
- 用户不需要先理解文件结构就能表达。
- 失败路径必须保留可恢复内容。

## P2 Library 与草稿记忆空间

目标：让用户理解并管理多个记忆空间，草稿记忆空间真实可见。

范围：

- Library 展示系统草稿记忆空间和普通记忆空间。
- 创建、打开和进入记忆空间。
- 最近记忆空间和基础记忆空间概览。
- 草稿记忆空间标记为系统空间。

质量门槛：

- Library 是空间管理，不是文件浏览器。
- 草稿记忆空间不引入第二套 inbox 模型。
- Home、Library、记忆空间的导航关系清楚。

## P3 记忆空间舞台与 Memory Studio

目标：让记忆空间像一个可行动的表达空间，而不是文件目录。

范围：

- 记忆空间三面板 shell。
- 左侧 memory 列表和折叠 tab。
- 中间默认记忆空间舞台。
- 选中 memory 后进入 `Memory Studio`。
- 右侧未来 AI 结构位和折叠 tab。

质量门槛：

- 中间面板承担主要体验。
- 记忆空间舞台支持表达、继续、重温摘要。
- `Memory Studio` 支持 asset 聚合、回放、笔记、继续表达和 review 入口。
- 未来 AI 结构位不展示伪聊天、假输出或未实现能力。

## P4 Move Memory

目标：让用户把草稿 memory 归入目标记忆空间。

范围：

- 从草稿记忆空间选择整条 memory。
- 选择目标记忆空间。
- 执行整条 memory 移动。
- 移动后进入目标记忆空间的 Memory Studio。

质量门槛：

- 第一阶段只移动整条 memory。
- 不支持单个 asset 跨记忆空间拆分移动。
- 用户交互表现为“归入记忆空间”，不暴露事务状态。
- 文件移动必须有明确失败保留和恢复路径。

## P5 Review 与 SRS 基础

目标：让用户选择性地重温 memory，并看到轻量记忆程度。

范围：

- Memory Studio 中加入 review opt-in。
- 轻量记忆程度展示。
- 下次重温时间。
- Guided Recall 嵌入模块。
- Home 和记忆空间舞台的今日重温摘要。

质量门槛：

- Review 是可选能力。
- 不把 Reo 收窄为学习软件。
- 不引入复杂算法或复杂状态机。
- 复述和回看入口必须鼓励表达，而不是只做被动浏览。

## P6 AI-ready 验证

目标：证明 Reo 记忆空间可以被外部 AI 清楚读取和协作。

范围：

- 记忆空间 root 的 `AGENTS.md` 描述记忆空间目的、结构和协作规则。
- Memory、asset、review 文件结构清楚。
- Codex CLI 可以进入记忆空间读取、解释和整理当前文件。
- 验证不依赖 Reo runtime 内 AI。

质量门槛：

- 不实现 AI chat、agent runtime、tool use 或自动整理。
- 不展示假 AI 功能。
- Codex CLI 验证只读边界、写入边界和用户文件真源。

## 后续方向

后续方向必须在第一阶段主链稳定后再进入：

- 视频 asset。
- 图片 asset。
- 笔记和 editor 深化。
- Home 草稿 panel。
- 单个 asset 级移动。
- 更完整的 SRS。
- Reo runtime 内 AI agent。
- 数据库、auth、同步、分享和发布能力。
