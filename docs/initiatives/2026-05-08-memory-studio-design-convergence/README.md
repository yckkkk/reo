# 记忆空间体验收敛

## 目标

把记忆空间体验收敛到用户提供的目标设计内容，并映射到 Reo 当前设计系统、Electron 边界和本地文件真源。

目标体验包含：

- 现有 AppShell sidebar：保持当前产品标识、顶层入口、记忆空间列表、折叠、resize 和主题切换行为。
- AppShell panel titlebar：当前记忆空间标题和右侧记忆列表折叠切换。
- Loaded 记忆空间 frame：中央主要体验区、右侧当前记忆列表或概览、底部表达 dock。
- 中央 Memory Studio：标题、创建信息、片段时间线、Segment 横向预览流、横向浏览按钮、当前片段播放与内容、内容 tab、SegmentAttachment `+` 菜单、继续表达和归入记忆动作。
- 底部表达 dock：录音、笔记、拍照、视频和上传等表达入口。
- 录音中态、录音回放态、图片态、视频态和空态。

## 边界

- 目标设计的内容和信息架构是产品目标；视觉系统必须使用 Reo tokens、Tailwind CSS v4、shadcn/ui source 和 Radix primitives。
- 现有 AppShell sidebar 保持不变；本 initiative 不重画 sidebar、不新增“记忆”或“收藏”等 sidebar 顶层入口。
- 右侧记忆列表属于 Workspace 层级，只展示当前 workspace 的 Memory；中间横向片段时间线属于 Memory 层级，只展示当前选中 Memory 内的 Segment。
- Segment 横向预览流只展示当前选中 Memory 内的 Segment。`CarouselArrowButton direction="left"` 和 `CarouselArrowButton direction="right"` 只控制该卡片流横向滚动，不承担播放、选择、编辑或删除职责；未溢出或到达边界时隐藏并退出可交互树。
- 内容 tab 最右侧 `+` 是 selected Segment 的 SegmentAttachment 添加菜单入口。当前目标只允许添加录音 attachment；它不新建 Memory，也不创建同级 Segment。
- 默认进入 workspace 时，中间是 Workspace Stage，不出现片段时间线；片段时间线只在用户进入某条 Memory 后出现。
- 底部 SpeedDial 可以渲染不可用的 action-shaped 位置来表达展开态布局；不可用 action 必须 `aria-disabled`、阻止选择，并且不能触发 IPC、DB、Query、Zustand 或文件写入。
- 拍照、视频、imported_file 和独立笔记必须先有 Segment 数据合同、文件事务、错误恢复、测试和 current 文档更新，才能成为可执行 runtime surface。
- SegmentAttachment 进入 runtime 前必须先定义 parent Segment identity、attachment 文件合同、IPC contract、Query 更新、恢复路径和视觉验证。
- 第一阶段不引入 DB、auth、AI runtime、同步、分享、全局搜索或自动整理。
- 允许每个 slice 在实现前审查是否缺少表、字段、依赖、Query key、状态 owner、Electron、打包、更新、日志、错误上报或测试基础设施；审查结果只能服务当前 slice，不得因为技术路线存在就一次性安装或配置全部技术栈。
- 每个 session 只推进一个可验证 slice；每个代码 slice 必须先有行为成功标准、真实 TDD、current 文档更新和 `npm run verify:quick`。

## 完成条件

- AppShell 和 loaded memory space 使用目标三面板结构，且在 Reo 设计系统中成立。
- 空态、选中 memory、录音中、录音回放、transcript 查看和已实现 Segment 状态都有真实 runtime 行为。
- 底部表达 dock 只让已经有真实能力和验证路径的入口可执行。
- 右侧切换 Memory，中间理解和继续当前 Memory，底部开始新的表达；三者职责不混淆。
- Memory Studio 以 Memory、Segment 和 SegmentAttachment 的关系组织内容，不把录音、转写、图片或视频表现为普通附件堆叠。
- Segment 横向预览流支持溢出浏览；左右按钮只影响卡片流，并在窗口尺寸、卡片数据和滚动位置变化后正确重新计算显示状态。
- SegmentAttachment `+` 菜单能在 selected Segment 语境中添加录音补充，不把 attachment 写成 Memory 顶层同级 Segment。
- 右侧面板只展示来自当前文件真源或明确 cache owner 的数据，不展示伪 AI 或伪推荐。
- 每个完成 slice 都同步 `docs/current/*`，保留验证证据，并通过用户验收。

## 读取入口

- `plan.md`：目标设计映射、组件边界和分阶段实现顺序。
- `tasks.md`：跨 session 里程碑。
- 当前 Memory 常态页设计 spec：`../../specs/2026-05-10-0443-memory-normal-page-design/README.md`。
