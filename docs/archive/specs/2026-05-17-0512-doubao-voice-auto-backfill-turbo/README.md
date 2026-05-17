# 豆包语音自动补转录（C，Turbo audio.data）

- 时间：2026-05-17 05:12 America/Los_Angeles
- 来源 initiative：`docs/initiatives/2026-05-16-doubao-voice-followups/`
- 本 spec 类别：主进程后台任务 + IPC/preload + renderer 手动重试 + 文档收口
- 当前目标：交付 C 自动补转录，产品约束是普通个人用户只配置 `X-Api-Key`，Reo 不要求 TOS、对象存储、AK/SK、平台服务或公网 URL。

## 当前目标

Reo 用户保存并启用豆包语音 `X-Api-Key` 后，所有 finalized audio Segment 与 SegmentSupplement 中满足 `lastTranscriptionAttempt='failed'` 且转录为空的对象，可以由 main process 自动或手动补齐转录。补转录使用火山引擎大模型录音文件极速版识别 API：

- endpoint：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- resource：`volc.bigasr.auc_turbo`
- headers：`X-Api-Key`、`X-Api-Resource-Id`、`X-Api-Request-Id`、`X-Api-Sequence: -1`
- body：`audio.data` base64 与 `request.model_name='bigmodel'`

该路径不需要公共 `audio.url`，不需要对象存储，不需要用户配置 AK/SK。Renderer 不接触音频路径、音频字节、API key、base64 或火山请求体。

## 决策依据

- 用户产品约束：Reo 当前定位是本地个人软件，普通用户只配置 `X-Api-Key`，不使用 TOS key，也不依赖 Reo 提供付费托管服务。
- 官方 Markdown：`/Users/yck/Downloads/PM/技术线/reo文件区/大模型录音文件极速版识别API.md` 明确极速版支持 `audio.url` 或 `audio.data` 二选一，新版控制台只需要 `X-Api-Key`，限制为 2h、100MB、WAV/MP3/OGG OPUS。
- 官方页面：`https://www.volcengine.com/docs/6561/1631584?lang=zh`
- 本地 demo：`/Users/yck/Downloads/PM/技术线/reo文件区/auc_python/auc_flash_demo.py` 与 `readme.md` 覆盖 flash endpoint、resource 和本地文件 base64 上传形态。
- 子代理调研结论：标准版 2.0 的 `audio.url` gate 对本地个人用户不可成立；Turbo flash 是当前唯一符合只配置 `X-Api-Key` 的官方文件识别路径。

## 范围

- 主进程 Turbo audio.data client，支持 abort、timeout、状态码分类和脱敏错误。
- 本地 finalized `audio.webm` 转换为官方支持格式后 base64 发送；优先 WebM/Opus 到 OGG/Opus remux。
- 串行 BackfillQueue：auto FIFO、manual 队首插入、不抢占 in-flight、去重、pause/resume、cancelAll、batch cap N=20、同 errorCode breaker K=3。
- Scanner：扫描 Segment 与 SegmentSupplement 的 failed-empty eligible 集合。
- Trigger：voice settings ok 上升沿、workspace ready 上升沿、录音打开暂停、workspace switch/lock lost/app quit cancel。
- 手动 IPC：
  - `workspace:requestSegmentTranscriptionBackfill`
  - `workspace:requestSegmentSupplementTranscriptionBackfill`
- Preload 与 renderer wrapper 只暴露窄方法。
- `SegmentTranscriptView` 增加 `running` outcome；App 持有 feature-local optimistic running set。
- 诊断写入现有 main 本地 `recordDiagnosticEvent`，字段 allowlist 不含 transcript、raw path、audio URL、audio.data、X-Api-Key、title 或用户正文。
- 同步 `docs/current/*`、ADR 0005、initiative，并在完成后归档本 spec。

## 范围外

- 标准版 2.0 `audio.url` 交付路径。
- TOS、对象存储、AK/SK、平台代理服务、公网隧道、本地公开 HTTP 服务。
- 流式 API 回放 finalized audio 作为文件补转录实现。
- 新 main-to-renderer backfill event channel。
- 新 Query key、Zustand store、manifest schema 扩展、转录编辑器、长任务进度条。

## 硬约束

- 不放松 Electron sandbox、contextIsolation、nodeIntegration、CSP、permission、navigation 边界。
- Renderer 不直接使用 Node/Electron API。
- X-Api-Key 只在 settings 保存请求和 main process 解密后的运行时输入中出现；不写日志、不返回 renderer、不写记忆空间。
- 自动任务对 UI 静默；只有手动触发使用 renderer-local optimistic running。
- 任务成功通过现有 transcript save 路径写入 Markdown，并把 manifest `lastTranscriptionAttempt` 置为 `'success'`。
- 失败保持 manifest `'failed'`，等待下次触发或用户手动重试。

## /goal 状态

本轮请求要求建立新的 `/goal`。工具调用 `create_goal` 返回当前线程已存在 goal，不能新建；本 spec 作为本 session 的执行目标真源，目标内容为：按普通个人用户只配置 `X-Api-Key` 的产品约束，基于豆包录音文件极速版 `audio.data` 路径完成 C 自动补转录实现、验证、review/ycksimplify、文档同步、归档与提交。

## 文件入口

- `goal.md`
- `plan.md`
- `tasks.md`
- `verification.md`

## 当前实现状态

- C 使用 Turbo flash `audio.data`，满足普通用户只配置 `X-Api-Key`。
- Main 已实现 Turbo client、audio data source、queue、scanner、runtime、diagnostics 和 IPC lifecycle wiring。
- Preload/renderer 已实现手动 Segment 与 SegmentSupplement 补转录请求、running outcome 和本地 optimistic running state。
- 真实 safeStorage key smoke 已通过，返回 `20000000 OK`。
- `npm run dev` 真实 Electron runtime QA 已通过，确认 preload 只暴露显式补转录方法且无 generic IPC surface。
- 最终 review / ycksimplify 发现均已处理：`45000010` 映射为 auth、无效 `workspace:close` 不再改变 backfill 生命周期、lock-lost 取消同 batch 队列、诊断错误码 allowlist 与音频读取上限已收敛。
- 最终验证已通过：`npm run verify:quick`、`npm run format:check`、`git diff --check`。
