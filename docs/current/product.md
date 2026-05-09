# 产品基线

本文档是 Reo 产品定位、核心体验和页面模型的当前真源。

## 定位

Reo 是本地优先的 AI-ready 记忆空间。它不是单纯录音工具，也不是文件管理器；录音、笔记、照片、视频和上传素材都应进入同一个 Workspace -> Memory -> Asset 模型。

一个 Workspace 是用户选择的本地记忆空间。一个 Memory 是可持续生长的记忆。一个 Asset 是 Memory 内的表达片段。当前已实现的 Asset 类型是 recording；note、photo、video 和 upload 进入 runtime 前必须先定义 Asset 文件合同、IPC contract、查询更新和恢复路径。

Reo 的核心目标是降低表达阻力，让用户更愿意记录、回看、继续补充，并让这些记忆保持用户拥有、可迁移、AI-readable。

## 产品气质

Reo 是安静、克制、温柔、有时间感的私人表达工作室。用户打开 Reo 的第一印象不应是管理、协作、数据库、项目推进或效率压迫，而应是一个可以慢慢说话、慢慢回想、慢慢沉淀自己的空间。

Reo 的美感来自对注意力的尊重：本地优先带来安全感，AI-ready 带来未来感，留白带来呼吸感，Memory 与 Asset 的生长关系带来生命感。

## 当前页面模型

### Home

Home 当前是全局入口 shell。它提供进入记忆空间、资料库和创建或打开 Workspace 的入口，不承载 Workspace 内的 Memory 导航。

### Library

Library 当前是资料库占位入口。它只显示资料库页面标题，不展示 Memory、Asset 或 Workspace 管理内容。Workspace 创建、打开、切换和移除当前由 AppShell sidebar 的记忆空间列表承担。

### Loaded Workspace

Loaded Workspace 使用三面板结构：

- 左侧 AppShell sidebar：全局导航和 Workspace 列表，保持当前入口，不承载当前 Workspace 内的 Memory 导航。
- 中间 Workspace Stage：默认表达舞台。未选中 Memory 时只表达“今天想记录些什么？”，不显示 workspace feed、全局时间线或文件流。
- 右侧 Memory rail：当前 Workspace 的全部 Memory 容器列表。它用于在 Memory 之间切换，不展示单个 Asset 详情。

当前 Workspace 标题显示在 AppShell panel titlebar。右上角 icon-only control 控制 Memory rail 折叠和展开；`新建记忆` icon-only control 先打开命名弹层，创建成功后才产生 Memory。

## 核心层级

- Workspace 层级：当前本地记忆空间，右侧 Memory rail 展示这个空间里的所有 Memory。
- Memory 层级：一条可持续生长的记忆。选中 Memory 后进入现有 memory detail route。
- Asset 层级：Memory 内的表达片段。当前 runtime 只实现 recording asset；`assetIds` 是 Memory 的核心关系，当前只接受已实现的 recording asset id。

中间面板的横向片段时间线只属于当前选中的 Memory。它不能表示整个 Workspace 的全部内容，也不能演变成 workspace feed、日志流、文件流或社交动态流。

## 当前表达入口

底部 Floating Action Button Speed Dial 是 Workspace Stage 的表达入口。当前唯一可执行 action 是录音。note、photo、video 和 upload 只保留不可用的 icon-only action 位置，用于表达已接受的信息架构，不触发 runtime surface。

录音流程使用浏览器 `MediaRecorder` 和 `getUserMedia` 的薄 adapter。Renderer 先通过 IPC 获得一次性 microphone intent，再请求 audio-only media stream。音频 chunk 通过 IPC 串行写入 main process 的 durable draft；stop 必须等待 MediaRecorder 最后的 `dataavailable` chunk 完成后再 finalize。

点击 Workspace Stage 的录音始终先进入新建 Memory 命名流程，创建成功后再进入录音流程。录音 finalize 必须显式归属到这个 Memory。在 Memory detail 中点击继续记录会追加到当前 Memory。

## 当前 Memory Detail

当前 Memory detail route 展示一条 Memory 的基础信息、recording summary、继续记录入口，以及 finalized recording 的本地回放、转写草稿和反思草稿编辑能力。

当前 detail 不是完整 Memory Studio。片段时间线、多模态 Asset 聚合、独立笔记 Asset、图片 Asset、视频 Asset 和 upload Asset 进入前必须先补齐文件合同、IPC、查询更新、错误恢复和视觉验证。

## AI 边界

当前不实现 Reo runtime 内的 AI agent、chat、tool use、自动整理或 AI side effects。

AI-ready 的当前验证方式是本地文件结构、`AGENTS.md`、Memory metadata、recording asset 和用户编辑文本可以被外部 AI 工具读取并理解。
