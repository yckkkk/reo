# First Product Slice Design Discipline

时间：2026-05-06 02:30 America/Los_Angeles

## Objective

补强 first product slice 的工程设计纪律，确保前端、后端、IPC、数据、状态和代码组织都不能按效果临时拼接。

本 session 不实现代码、不安装依赖。

## 输出

- 更新 `docs/current/architecture.md`
- 更新 `docs/current/foundation.md`
- 更新 `docs/current/electron.md`
- 更新 `docs/current/frontend.md`
- 更新 `docs/current/data.md`
- 更新 `docs/current/flow.md`
- 更新 `docs/initiatives/2026-05-06-first-product-slice/engineering-readiness.md`
- 更新 `docs/initiatives/2026-05-06-first-product-slice/next-session-handoff.md`
- 更新 `docs/initiatives/2026-05-06-first-product-slice/plan.md`
- 更新 `docs/initiatives/2026-05-06-first-product-slice/tasks.md`
- 将下一 session 明确为完整 first product slice 长任务 goal，而不是只完成一个小 slice。
- 增加 reuse-first gate：整个软件工程设计都必须先评估官方和成熟开源方案，不得把自研当默认选项。
- 增加 ElevenLabs UI、Vaul、wavesurfer.js 和新录音 drawer 视频作为 audio/overlay 设计门禁输入。
- 记录独立对抗审查：`review.md`

## TDD 豁免

本 session 只修改文档和实现前门禁，不改变运行时代码或产品行为。TDD 豁免。验证使用格式、静态检查、镜像检查和工作区状态检查。
