# 0005 豆包录音文件识别自动补转录引擎基线

## 决策

C 自动补转录默认使用火山引擎大模型录音文件识别标准版 2.0，也就是 SeedASR AUC：

- Submit endpoint：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit`
- Query endpoint：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query`
- `X-Api-Resource-Id`：`volc.seedasr.auc`
- 鉴权：新版控制台单 `X-Api-Key`，并带 `X-Api-Resource-Id`、`X-Api-Request-Id`、`X-Api-Sequence: -1`
- 请求：`audio.url`、`audio.format` 必填；Reo 提交 `audio.format='ogg'`、`audio.codec='opus'`
- 调用形态：BackfillQueue 内单 task 执行 submit + query 轮询；对 IPC 调用方仍表现为一次同步 await 的任务

极速版 `volc.bigasr.auc_turbo` 不作为 C 默认引擎。闲时版 `volc.bigasr.auc_idle` 不作为 C 自动补转录或 inline retry 引擎。

## C-0b 交付方案

标准版 2.0 只接受火山服务器可访问的 `audio.url`。Reo finalized audio 是本地 `.reo/.../audio.webm`，不能直接交给火山服务器读取。

Reo 使用 main-only TOS staging 交付该 URL：

1. Main process 从现有 finalized audio read path 读取 bounded audio bytes。
2. 使用显式 `REO_BACKFILL_FFMPEG_PATH` 将 WebM/Opus remux 为 OGG/Opus。
3. 使用显式 TOS 配置上传 staged object。
4. 生成短 TTL GET URL 交给标准版 2.0 submit。
5. 任务完成、失败或取消后删除 staged object。

需要的 main process 配置：

- `REO_BACKFILL_TOS_ACCESS_KEY_ID`
- `REO_BACKFILL_TOS_ACCESS_KEY_SECRET`
- `REO_BACKFILL_TOS_BUCKET`
- `REO_BACKFILL_TOS_ENDPOINT`
- `REO_BACKFILL_TOS_REGION`
- `REO_BACKFILL_FFMPEG_PATH`
- 可选：`REO_BACKFILL_TOS_KEY_PREFIX`
- 可选：`REO_BACKFILL_TOS_GET_URL_TTL_SECONDS`

缺少配置时 backfill fail-fast，不默认上传用户录音。

## 安全边界

- 不在 main process 暴露公开本地 HTTP 服务。
- 不使用公网隧道作为产品路径。
- 不默认把用户本地录音上传到未配置对象存储。
- Renderer/preload 不接触 raw path、audio bytes、临时 URL、TOS credential、X-Api-Key、provider raw error、title、用户文本或 transcript。
- Backfill diagnostics 只记录 allowlisted event/error/duration/count，不记录 path、URL、object key、credential 或正文。
- Electron sandbox、contextIsolation、nodeIntegration、CSP、permission 和 navigation 基线不改变。

## 格式与依赖

- Reo finalized audio 当前是 MediaRecorder WebM/Opus。
- 标准版 2.0 官方格式支持 raw/wav/mp3/ogg，codec 支持 raw/opus。
- Reo 采用 WebM/Opus -> OGG/Opus remux，避免第一版重编码。
- 本轮不安装 ffmpeg npm package；运行时要求显式 ffmpeg binary path。
- `@volcengine/tos-sdk@2.9.1` 试装后因 axios high vulnerabilities 被拒绝；实现使用 Node `crypto` + `fetch` 做 TOS signing。

## 凭证与 smoke

Reo 复用 voice settings 中的用户 X-Api-Key 调用 `volc.seedasr.auc`。本 session 没有真实 SeedASR/TOS 配置和计费授权，因此未执行 live submit/query smoke，也未证明同一 key 在真实账号下同时具备 SAUC streaming 与 AUC 标准版 2.0 权限。

上线前必须用真实配置执行一次小样本 smoke：

- TOS PUT 成功
- presigned GET 可由 provider 访问
- submit 返回 accepted
- query 返回 success 或可解释的空音频结果
- staged object 删除成功
- 日志与 IPC response 不含敏感字段
- 记录实际费用或确认无额外 probe 常驻成本

## 理由

- 标准版 2.0 与 Reo 当前直播转写 `volc.seedasr.sauc.duration` 同属 SeedASR 2.0，补转录文本质量与 live transcript 风格更一致。
- 标准版 2.0 的官方计费页显示小时单价低于大模型录音文件极速版，更适合作为后台自动补转录默认路径。
- 异步 submit/query 增加的复杂度封装在 BackfillQueue task 内，不改变 renderer optimistic 状态、手动 retry IPC 语义或自动任务静默策略。
- 极速版支持 `audio.data` base64，工程上更容易投递本地音频，但它是 BigASR 1.0 路径，且成本不满足本功能默认路径要求。
- 闲时版最长返回时效不适合用户手动 retry。

## 关联文档

- `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`
- `docs/archive/specs/2026-05-17-0029-doubao-voice-auto-backfill/`
- `docs/initiatives/2026-05-16-doubao-voice-followups/`
- 火山官方文档 `https://www.volcengine.com/docs/6561/1354868?lang=zh`
- 火山官方文档 `https://www.volcengine.com/docs/6561/1631584?lang=zh`
- 火山官方文档 `https://www.volcengine.com/docs/6561/1840838?lang=zh`
- 火山官方计费页 `https://www.volcengine.com/docs/6561/1359370?lang=zh`
