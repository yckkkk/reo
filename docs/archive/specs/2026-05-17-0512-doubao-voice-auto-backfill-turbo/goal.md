# 目标

完成 C 自动补转录的重新交付：用户只配置豆包语音 `X-Api-Key`，Reo 在本地读取 finalized audio，经 main process 转换为官方支持格式后调用大模型录音文件极速版 `audio.data`，把失败且空转录的 Segment 与 SegmentSupplement 补齐。

## 成功标准

- 标准版 `audio.url` / TOS staging 方案不再作为 C 当前设计。
- 用户无需填写 TOS bucket、endpoint、region、AK、SK 或任何 Reo 平台服务配置。
- 自动触发与手动重试都复用同一个 main-side queue。
- 手动重试有 `running` UI，中间态不持久化；自动任务静默。
- 成功写回 `segment.md` 或 `supplement.md`，并复用既有 manifest success 写入路径。
- 失败、取消、超大、格式错误、鉴权、限流、网络、服务繁忙、空音频、静音音频都有 typed error 或明确策略。
- Electron 安全边界不变。
- 新 IPC/preload/renderer surface 有 contract、测试和 current docs。
- 行为改动有 RED/GREEN/REFACTOR 证据。
- 真实 API key smoke/E2E 覆盖 Turbo flash 路径；若外部账号缺少 `volc.bigasr.auc_turbo` 权限，最终状态只能是 DONE_WITH_CONCERNS 并记录证据。
- C spec 已归档后，initiative 进入 C→D readiness；D 仍需单独 spec。

## C-0 gate

C-0 通过条件改为：

1. 官方依据确认 Turbo flash 支持 `audio.data` base64 和新版控制台单 `X-Api-Key`。
2. Reo 本地 WebM/Opus 有可安装、可打包、无需用户配置的本地转换路径。
3. Smoke probe 使用真实 `X-Api-Key` 调用 Turbo flash，不记录密钥、base64、raw path 或 transcript。

若 Turbo 权限不可用，代码仍可以完成并通过 mocked tests，但 live E2E 必须标为外部账号权限阻断，不能声称 100% 完成。

本轮真实 safeStorage key smoke 已通过 Turbo flash，账号权限不是阻断项。
