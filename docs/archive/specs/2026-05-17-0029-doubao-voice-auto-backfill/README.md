# 豆包语音自动补转录（C）

- 时间：2026-05-17 00:29 America/Los_Angeles
- 来源 initiative：`docs/initiatives/2026-05-16-doubao-voice-followups/`
- 范围：C-0b gate、SeedASR AUC 标准版 2.0 客户端、main 后台队列、扫描与触发、手动 IPC / preload / renderer retry、录音暂停、breaker、诊断、文档同步与归档
- 状态：实现完成；live provider smoke 未执行，原因是本 session 没有可用的 TOS/SeedASR 生产凭证与可计费 smoke 输入

## C-0b 结论

标准版 2.0 `volc.seedasr.auc` 仍是 C 默认引擎：

- Submit：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit`
- Query：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query`
- Resource：`volc.seedasr.auc`
- Header：`X-Api-Key`、`X-Api-Resource-Id`、`X-Api-Request-Id`、`X-Api-Sequence: -1`
- 输入：`audio.url` 必填；`audio.format` 使用 `ogg`，`audio.codec` 使用 `opus`

C-0b 采用的安全交付方案是 main-only Volcengine TOS staging：

1. Main process 读取 finalized `audio.webm` bytes。
2. 使用用户显式配置的 `REO_BACKFILL_FFMPEG_PATH` 把 WebM/Opus remux 为 OGG/Opus。
3. 使用用户显式配置的 TOS bucket、endpoint、region、access key id/secret 上传 staged OGG object。
4. 生成短 TTL GET URL 交给标准版 2.0 submit。
5. task 完成、失败或取消时删除 staged object。

该方案不启动公开本地 HTTP 服务，不使用公网隧道，不默认上传到未配置对象存储，不把 raw path、audio bytes、临时 URL、TOS credential、X-Api-Key、title、用户文本或 transcript 暴露给 renderer、preload、IPC response、Query cache、DOM 或诊断日志。缺少 TOS 或 ffmpeg 配置时 fail-fast 为 backfill audio URL typed error。

## 官方与本地依据

- Context7 未覆盖可直接采用的 SeedASR AUC/TOS SDK 当前合同；本轮使用火山官方站点和包元数据验证。
- 标准版 2.0 官方文档确认 submit/query、`volc.seedasr.auc`、新版 `X-Api-Key` header 和 URL-only `audio.url`。
- 极速版官方文档确认 `audio.data` base64 只属于 `volc.bigasr.auc_turbo`，不作为 C 默认路径。
- 闲时版官方文档确认 24h 返回边界，不适合 inline retry。
- 计费页确认标准版 2.0 成本低于极速版。
- 本地 demo `/Users/yck/Downloads/PM/技术线/reo文件区/auc_python` 只作为旧版 / 极速版示例和 key 形态补充证据，不能作为新版标准版 2.0 客户端基线。
- `@volcengine/tos-sdk@2.9.1` 试装后 `npm audit` 暴露 axios high vulnerabilities，本实现改用 Node crypto/fetch 原生 TOS signing，不引入 SDK 依赖。
- ffmpeg 包评估后不引入 bundled dependency；运行时要求显式 `REO_BACKFILL_FFMPEG_PATH`。

## 运行时行为

- 自动触发：workspace ready 或 voice settings 从非 ok 进入 `enabled && apiKeyConfigured && lastValidationOk` 时，扫描当前 workspace。
- Eligible target：finalized audio Segment 或 SegmentSupplement，`lastTranscriptionAttempt='failed'`、transcript 空、audio bytes 大于 0。
- 队列：concurrency=1；auto FIFO；manual 插队到队首但不抢占 in-flight；同 target 去重。
- 写回：auto 成功后复用现有 transcript save 函数；manual IPC 成功后同步返回现有 save response shape。
- 保护：auto batch cap N=20；同 batch 同 errorCode 连续 K=3 触发 breaker；manual 不受 cap/breaker 限制。
- 生命周期：recording overlay open 暂停出队，close 后恢复；workspace switch、lock lost、renderer gone、app quit 取消并清理 staged object。
- UI：自动任务静默；手动 retry 只用 App feature-local optimistic running set 展示 `SegmentTranscriptView` running 文案。

## 收口风险

本 session 没有 live SeedASR/TOS smoke 证据，因此不能声称外部服务已在真实账号、真实 bucket 和计费环境中通过。代码路径、签名、错误映射、cleanup、IPC/security、renderer running state 和文档已通过本地自动化验证；上线前仍需用真实配置执行一次小样本 smoke，记录 submit/query status、TOS cleanup 和费用。

## 文件入口

- 产品说明：`goal.md`
- 工程说明：`plan.md`
- 实施清单：`tasks.md`
- 验证证据：`verification.md`
