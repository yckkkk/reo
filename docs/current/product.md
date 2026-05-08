# 产品基线

本文档是 Reo 产品定位、核心体验和页面模型的当前真源。

## 定位

Reo 是本地优先的 AI-ready memory workspace。

一个 workspace 是用户自定义主题的记忆空间。用户可以在其中沉淀录音、视频、笔记、图片等记忆材料。Reo 的核心目标是降低表达阻力，让用户更愿意记录和说话，并让这些记忆可以被回看、整理、迁移、重温和未来 AI 协作读取。

Reo 不限定用户用途。一个 workspace 可以是一门课、一本书、一个项目、一次生活经历、一个生日派对、零碎灵感或任何用户定义的记忆主题。

## 产品主线

第一阶段只服务一条主线：让用户更愿意表达，并把表达沉淀成可移动、可重温、AI-readable 的 memory。

第一阶段不是文件管理器、录音工具或 AI chat。Reo 的文件结构服务用户拥有和 AI 可读，产品体验服务表达、继续补充和重温。

## 体验原则

- 流程优先于页面。Home 开始表达、保存到草稿、补充成 memory、移动到 workspace、后续重温，这条链路必须顺。
- 组件体验是产品核心。录音、暂停、继续、停止、保存、回放、笔记编辑、移动 memory、加入 review 都必须作为高质量交互组件设计。
- 已有组件不自动代表完成。录音 drawer、audio player、workspace card、memory detail、form、sidebar 和 menu 都必须按完整用户流程重新审视。
- 不做复杂状态机。产品心智保持简单，必要复杂度留在文件事务、权限和恢复边界内。
- 遵守雅各布定律。Home 使用 dashboard 心智，Library 使用空间管理心智，Workspace 使用 macOS split-view 和三面板心智。
- 使用奥卡姆剃刀。不引入 inbox、folder、tag、collection、project、task、session 等额外实体，除非它们解决当前真实阻塞。

## 核心实体

- `Workspace`：一个记忆空间，包括系统草稿工作区。
- `Memory`：一条可被保留、继续补充、移动、重温的记忆。
- `Asset`：Memory 内的录音、视频、笔记、图片。
- `Review`：可选的 SRS 和记忆程度记录。

## 信息架构

### Home

Home 是全局 dashboard。它展示即时表达入口、草稿状态、最近 workspace、今日重温摘要、表达和记忆概览。

Home 不承担 workspace 文件管理。Home 的即时表达入口默认保存到草稿工作区。

### Library

Library 管理所有 workspace。系统草稿工作区在 Library 中可见，并标记为系统草稿空间。普通 workspace 可以创建、打开和进入。

Library 是空间管理界面，不是文件浏览器。

### Workspace

Workspace 使用三面板结构：

- 左面板：当前 workspace 的 memory 列表，可折叠为 tab。
- 中间面板：主要体验区。
- 右面板：未来 AI agent 结构位，可折叠为 tab；第一阶段不实现 AI runtime。

中间面板有三个产品形态：

- `Workspace Stage`：默认态。用户不需要先选择 memory 就能开始表达、继续最近内容或进入重温。
- `Memory Studio`：选中 memory 后的详情态。聚合 assets、笔记、继续表达、回放、移动和 review 入口。
- `Guided Recall`：后续嵌入模块。用于 SRS、复述、回看和记忆程度反馈。

### Draft Workspace

草稿工作区是 Reo 管理的系统 workspace。它和普通 workspace 使用同一套数据模型；差别只是 root directory 由 Reo 确定。

Home 的即时表达默认进入草稿工作区。草稿工作区第一阶段在 Library 里可见。后续 Home 可以增加草稿 panel，用于展示未归属 memory 数量和整理入口。

第一阶段只支持移动整条 memory 到目标 workspace，不支持单个 asset 跨 workspace 拆分移动。

## AI 边界

第一阶段不实现 Reo runtime 内的 AI agent、chat、tool use、自动整理或 AI side effects。

当前 AI-ready 的验证方式是 Codex CLI 能直接读取 workspace 文件、`AGENTS.md`、memory、asset 和 review 文件，并理解 workspace 目的和协作规则。

右侧 AI 面板第一阶段只是结构位。它不能展示伪聊天、假输出或未实现能力。

## 关键体验组件

### 录音表达组件

录音表达组件是第一阶段最高优先级组件。它必须覆盖：

- 开始前降低表达压力。
- 麦克风权限说明清楚。
- 录音中提供稳定的 waveform、timer、暂停和停止反馈。
- 暂停后可以继续或放弃。
- 停止后可以回放、改标题、补充笔记和保存草稿。
- 失败时保留可恢复内容，不让用户误以为内容丢失。
- 保存后进入 Memory Studio 或草稿整理路径。

### Memory Studio

Memory Studio 是一条 memory 的工作区。它展示 asset 聚合、录音回放、笔记和 reflections、继续表达、移动到 workspace、加入 review。

Memory Studio 不是文件详情页。它表达的是“这条记忆如何继续生长”。

### Move Memory

Move Memory 组件负责把整条 memory 从草稿工作区移动到目标 workspace。

第一阶段不支持移动单个 asset。移动交互应表现为“归入某个记忆空间”，不能把文件事务复杂性暴露给用户。

### Review

Review 是可选 SRS 入口。第一阶段只做轻量记忆程度、下次重温和复述入口，不引入复杂学习算法或完整学习软件模型。

### Library Workspace

Library Workspace 组件展示草稿 workspace、普通 workspace、最近使用、创建和打开。它必须让用户理解草稿 workspace 是真实 workspace，而不是第二套 inbox。
