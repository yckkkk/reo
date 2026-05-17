# 0005 豆包录音文件识别自动补转录引擎基线

## 决策

C 自动补转录默认使用火山引擎大模型录音文件识别标准版 2.0，也就是 SeedASR AUC：

- Submit endpoint：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit`
- Query endpoint：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query`
- `X-Api-Resource-Id`：`volc.seedasr.auc`
- 鉴权：新版控制台单 `X-Api-Key`，并带 `X-Api-Resource-Id`、`X-Api-Request-Id`、`X-Api-Sequence: -1`
- 凭证：复用 Reo 当前 voice settings 中的用户 X-Api-Key；C-0 smoke 必须验证它同时可用于 SAUC streaming 与 AUC 标准版 2.0
- 请求：`audio.url` 与 `audio.format` 必填；format 使用官方支持的 `raw` / `wav` / `mp3` / `ogg`；codec 按 format 需要传入
- 调用形态：BackfillQueue 内单 task 执行 submit + query 轮询；对 IPC 调用方仍表现为一次同步 await 的任务

极速版 `volc.bigasr.auc_turbo` 不作为 C 默认引擎。闲时版 `volc.bigasr.auc_idle` 不作为 C 自动补转录或 inline retry 引擎。

## 理由

- 标准版 2.0 与 Reo 当前直播转写 `volc.seedasr.sauc.duration` 同属 SeedASR 2.0，补转录文本质量与 live transcript 风格更一致。
- 标准版 2.0 的官方计费页显示小时单价低于大模型录音文件极速版，更适合作为后台自动补转录默认路径。
- 异步 submit/query 增加的复杂度可以封装在 BackfillQueue task 内，不改变 renderer optimistic 状态、手动 retry IPC 语义或自动任务静默策略。
- 极速版支持 `audio.data` base64，工程上更容易投递本地音频，但它是 BigASR 1.0 路径，且成本不满足本功能默认路径要求。
- 闲时版最长返回时效不适合用户手动 retry，也不解决标准版同样存在的 `audio.url` 本地音频交付问题。

## Implementation Gate

标准版 2.0 只接受火山服务器可访问的 `audio.url`。Reo finalized audio 当前是本地 `.reo/.../audio.webm`，火山服务器不能读取本地文件路径。因此 C-1/C-2/C-3 实施前必须先通过 C-0b：

- 产出一个不破坏本地优先和 Electron 安全边界的 `audio.url` 交付方案。
- 不在 main process 暴露公开本地 HTTP 服务。
- 不使用公网隧道作为产品路径。
- 不默认把用户本地录音上传到未配置的对象存储。
- 验证 WebM/Opus 到官方支持格式的路径；优先评估 OGG/Opus remux，若不可行再评估 WAV/MP3 转码依赖、打包体积和运行时成本。
- 验证同一 X-Api-Key 对 SAUC streaming 与 AUC 标准版 2.0 都可用。
- 验证 `20000000`、`20000001`、`20000002`、`45000002`、`45000131`、`45000132`、`45000151` 与 `550xxxx` 的映射和轮询超时策略。

若 C-0b 无法在上述边界内通过，C 自动补转录暂停，不进入实现。

## 不在本 ADR 范围

- 对象存储配置、凭证 UX 或费用提示。
- D More 菜单与确认弹层。
- transcript 写回合同变更。
- Segment 或 SegmentSupplement manifest schema 变更。
- BackfillQueue 之外的并发调度系统。

## 关联文档

- `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md` 记录直播转写 SeedASR SAUC 基线。
- `docs/specs/2026-05-17-0029-doubao-voice-auto-backfill/` 记录 C 自动补转录当前 spec 与 C-0 findings。
- `docs/initiatives/2026-05-16-doubao-voice-followups/plan.md` 记录 B/C/D/E initiative 的当前顺序。
- 火山官方文档 `https://www.volcengine.com/docs/6561/1354868?lang=zh` 记录标准版 2.0 submit/query、resource id 与请求字段。
- 火山官方文档 `https://www.volcengine.com/docs/6561/1631584?lang=zh` 记录极速版同步接口与 `audio.data` 支持。
- 火山官方文档 `https://www.volcengine.com/docs/6561/1840838?lang=zh` 记录闲时版接口边界。
- 火山官方计费页 `https://www.volcengine.com/docs/6561/1359370?lang=zh` 记录录音文件识别计费口径。
