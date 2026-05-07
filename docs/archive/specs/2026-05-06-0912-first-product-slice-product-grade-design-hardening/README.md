# First Product Slice 产品级设计返工

时间：2026-05-06 09:12 America/Los_Angeles

状态：design-hardening gate 已通过。本文档集是对 first product slice 的设计返工证据，归档后不再作为 implementation 阶段执行权威。

## 目标

本 spec 纠正前一轮 first product slice 过度收缩成 MVP 的问题。当前实现已经证明基础链路可运行，但产品设计输入不足：创建工作区、首页、工作区详情、录音弹层、录音后编辑和反思弹层没有达到交付级设计，且没有完整参考图映射、开源复用判断、全部状态和数据/安全/QA 门禁。

本轮目标是把设计门禁补到可执行实现计划之前需要的标准：

- 本次设计范围内的界面必须给出符合 Reo 当前设计系统的 high-fidelity 状态规格。
- 不属于当前实现范围的功能必须参考全部设计图给出交付级 wireframe。
- 录音、波形、播放、转写、反思编辑优先从 ElevenLabs UI、shadcn/ui、Radix、Vaul、wavesurfer.js 和成熟开源实现中复用、裁剪、retokenize 或薄适配。
- 明确数据库模式、表关系、数据获取、文件夹结构、错误处理和 TDD/QA 门禁。
- 不把未实现的 photo、video、file、film 能力显示成当前可用功能。
- 不把 DB 当作用户内容真源。

## 当前结论

当前 implementation branch 上的代码不能作为 first product slice 的最终交付。它只能作为基础能力 spike 和已有 TDD 证据，必须由新的 reconciled implementation plan 按本 spec 返工。

当前阻断点：

- `WorkspaceHome` 没有 covered/expanded/resizing layered sidebar、搜索/过滤结构、时间分组、工作区详情入口或交付级空态。
- `CreateWorkspaceForm` 是窄表单，没有工作区创建流程的 high-fidelity 页面状态、最近工作区、路径风险、冲突恢复或导入/open 分支。
- `RecordingOverlay` 是普通 Dialog 内容，缺少参考图的大型 bottom drawer、实时波形、录音中转写视觉、空录音状态、permission/acquiring/paused/stopping/error/playback/reflections 全状态。
- `RecordingOverlay` 仍使用 mock transcript 文案，必须在设计上降级为手写草稿，不能暗示真实 STT；如果采用实时转写，需要新 foundation 和真实模型/服务边界。
- archived design-hardening 中“first slice 不显示完整 sidebar”“不引入 Vaul”“wavesurfer deferred”“ElevenLabs UI 只做视觉参考”的决定被本 spec supersede。
- current docs 描述当前代码事实；本 spec 的长期结论已转交 active initiative，不代表代码已经实现。

## 文件说明

- `requirements.md`：产品、设计、技术、QA 和文档生命周期要求。
- `reference-map.md`：6 张参考图与当前实现的差距矩阵。
- `ui-blueprint.md`：本次范围 high-fidelity 设计和范围外 wireframe。
- `traceability-matrix.md`：需求到设计、数据、协议、QA 的追踪。
- `external-research.md`：Context7、ElevenLabs UI、shadcn Drawer/Vaul、wavesurfer.js、Practical UI 研究依据。
- `reuse-decisions.md`：强制复用类别的候选、决策、适配路径、风险、测试和 owner。
- `accessibility-matrix.md`：页面、组件、状态的无障碍设计。
- `architecture-views.md`：前端、Electron、数据和文件结构视图。
- `data-contracts.md`：DB schema、表关系、query keys、文件真源和状态归属。
- `filesystem-transactions.md`：workspace 文件结构、事务和恢复。
- `protocol-contracts.md`：preload/IPC/capability contract。
- `security-threat-model.md`：Electron、安全、隐私和文件威胁模型。
- `state-machines.md`：工作区、sidebar、录音、编辑、播放和错误状态机。
- `qa-matrix.md`：TDD、视觉、runtime、reference 和回归验证矩阵。
- `foundation-decisions.md`：技术栈锁定和 activation gate。
- `code-simplicity.md`：避免 generic runtime/service/IPC 和过度抽象。
- `implementation-plan-reconciliation.md`：对已归档计划的 supersession 结论。
- `new-session-handoff.md`：阶段交接。
- `review.md`：审查记录。
- `verification.md`：本 spec 的验证证据。
