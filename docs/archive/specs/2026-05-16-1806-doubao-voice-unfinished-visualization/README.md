# 豆包语音未转录状态可视化（B）

- 时间：2026-05-16 18:06 America/Los_Angeles
- 来源 initiative：`docs/initiatives/2026-05-16-doubao-voice-followups/`
- 本 spec 类别：跨数据模型 + IPC + 前端的小切片功能 spec
- 范围：B-0 manifest 状态字段；B-1 Memory Studio 转录 tab 失败状态 + 重试 CTA；B-2 Sidebar 凭证失效红点

## 信息优先级（输入冲突时的解释顺序）

1. 用户在 brainstorm 中最新确认的共识（plan.md 中的"共享数据模型"与 B 段）
2. `docs/current/*` 当前真源（data / electron / frontend / flow / quality）
3. 已归档 spec / ADR：
   - `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`
   - `docs/archive/specs/2026-05-16-0605-doubao-voice-byok-settings/`
   - `docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/`
4. 现有源码事实（manifest schema、`SegmentTranscriptView`、`MemoryStudio`、`AppShell` Sidebar、`VoiceSettingsPanel`）
5. 本文档内的早期判断与新信息冲突时，以本次最新版本为准
6. 不引入超出共识的视觉结构、状态字段或 IPC channel；遇到未覆盖判断，本 spec 内显式标"假设"并提请用户复核

## 范围（in-scope）

- 在 segment manifest 与 supplement manifest 上新增 `lastTranscriptionAttempt: 'success' | 'failed' | 'never'` 字段
- 调整 finalize、transcript save、completion backfill 路径以在每个节点正确写入该字段
- 调整 Memory detail projection / Workspace snapshot projection，把该字段以派生形式暴露给 renderer
- 在 `SegmentTranscriptView` 与对应消费方加入失败状态文案与重试 inline CTA
- 在 Sidebar 设置入口加入凭证失效红点（基于 `voiceSettings.lastValidationCode='auth'`）
- 重试 CTA 的实际写入路径调用 D 的引擎，**但 D 的引擎合同本 spec 不实现**——B 只暴露 callback prop，让上层在 D 完成前接 noop 或 stub

## 范围外（out-of-scope）

- 离线 flash 引擎实现（C）
- 后台轮询任务（C）
- More 菜单"重新生成转录"（D）
- RecordingOverlay 三态文案对齐（initiative 已剔除）
- Memory rail Memory item 上的聚合 badge（initiative 已剔除）
- 网络失败 vs 认证失败的文案区分（三值已合并为 `'failed'`）
- 用户手动编辑 transcript 文本能力
- 旧 segment / 旧 supplement 的批量回填（参见 plan.md 的 "字段缺失即按 never" 规则）

## 硬约束（不可破坏）

- 不引入新 IPC channel
- 不引入新 Query key（B-2 复用 `['settings', 'voice']`）
- 不放松 manifest schema `.strict()` 约束；新字段以"optional + 缺失视为 never"形式接入
- 不在 segment.md / supplement.md frontmatter 内写入该字段
- 不为 B-1 重试 CTA 在本 spec 内实现真实转录引擎；只提供 callback 接口
- 不打破 single-active-spec 规则；本 spec 完成归档后才能进入 C

## 最终目标总结（可放在研发任务顶部）

本 spec 的最终交付是：让用户在 Reo 内对"录音没有转录"这件事第一次能区分"系统失败 / 用户意图 / 没事可做"三种语义。Reo 把"上一次转录尝试结果"写入 segment 与 supplement 的 `.reo/objects/*` manifest 作为三值技术真源（`'success' | 'failed' | 'never'`），并在 Memory Studio 的转录 tab 与每条补充录音的转录区里，当且仅当上次系统侧失败且转录仍为空时，显示「上次生成转录失败」+「重试」inline 行内按钮；点击「重试」调用上层注入的 callback（D 引擎合同到位后接通真实重新生成路径，本 spec 内可以接 noop stub）。Sidebar 左下角的设置齿轮按钮在最近一次凭证 probe 返回 `auth` 失败时叠加一个红色 dot，跨 workspace 一致，不打开任何弹层。本 spec 不引入新 IPC、不引入新 Query key、不引入后台任务、不引入引擎实现；唯一新增的持久结构是 manifest 上 optional 的三值字段，缺失视为 `'never'` 以兼容旧文件。验收依据 verification.md：finalize/saveTranscript/backfill 三条路径在 manifest 上写入正确三值；旧 segment 在 startup 后 `lastAttempt` 派生为 `'never'` 且不进入 B 失败可视化；Memory Studio 与 SegmentSupplement panel 在 `failed ∧ exists=false` 时显示重试 CTA 并能触发 callback；Sidebar 红点随 `lastValidationCode` 变化即时同步。所有路径必须通过现行 TDD 红线（先 RED、再 GREEN、再 REFACTOR），`npm run verify:quick` 必须通过，本 spec 与 `docs/current/data.md` / `docs/current/frontend.md` / `docs/current/flow.md` / `docs/current/electron.md` 的相关段落必须在收口时同批更新。

## 验证入口

- 详细产品功能说明：`goal.md`
- 工程实现说明 + 状态机 + 组件元素：`plan.md`
- 实施清单（TDD 步骤）：`tasks.md`
- 边界情况 + 验收 + 最终复核：`verification.md`
