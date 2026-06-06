# Tasks：Agent-created Works 与 Shared Generative Runtime

只记录跨工作单元里程碑与状态，不复制 spec 执行清单。

## 状态

- M0 模型、skill 与 M1 实施 spec - 已完成：
  `docs/archive/specs/2026-06-03-0630-agent-created-works-model/`
- M1 静态作品与沙箱预览 - first slice 已完成：
  `docs/archive/specs/2026-06-03-0630-agent-created-works-model/`
- M2 Shared Generative Runtime - works consumer 已完成：
  `docs/archive/specs/2026-06-03-1205-shared-generative-runtime/`
  - workspace-wide runtime read、作品手动刷新、state 写入不重挂 iframe、真实环境 E2E、xhigh 审查和 `verify:quick` 已覆盖。
- M3 Workspace Rail Widgets - 已完成：
  `docs/archive/specs/2026-06-05-0515-workspace-rail-widgets/`
  - Workspace-level widget 文件真源、右侧 rail tab 挂载、widget iframe lifecycle、`reo-render://` 复用、`ui.selectMemory`、runtime 视觉验证和 `verify:quick` 已覆盖。
- Works / Widget 技能升级：explorable 能力、设计系统融合与信息架构 - 已完成：
  `docs/archive/specs/2026-06-05-2037-works-explorable-and-design-cohesion/`
  - `reo-works-design` 现在包含 source->derive->render 参考、5 个可运行黄金范例、Reo app theme.css 投影 token、Widget 窄栏范例和跨 skill 入口链接。

## 下一步

M4+ Widget 完整形态联动未排期。后续 Home/Memory tab、Gallery、回顾 mechanics、复习日历、跨 Memory 工具和更高野心的 explorable 作品继续复用 Shared Generative Runtime，不重建 widget 专用 runtime。

## 已融合草稿

本 initiative 已吸收并替代并行草稿
`docs/initiatives/2026-06-03-generative-ui-artifact-widget/`。
不要从两套 initiative 并行实施。
