# 0005 豆包录音文件识别自动补转录引擎基线

## 决策

C 自动补转录默认使用火山引擎大模型录音文件极速版识别 API：

- Endpoint：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- `X-Api-Resource-Id`：`volc.bigasr.auc_turbo`
- 鉴权：新版控制台单 `X-Api-Key`，并带 `X-Api-Resource-Id`、`X-Api-Request-Id`、`X-Api-Sequence: -1`
- 凭证：复用 Reo voice settings 中用户保存的 X-Api-Key
- 请求：`audio.data` base64，本地音频由 main process 转为官方支持格式后提交；`request.model_name` 固定 `bigmodel`
- 调用形态：单次 HTTP request 返回识别结果；BackfillQueue 对 IPC 调用方仍表现为一次同步 await 的任务

标准版 2.0 `volc.seedasr.auc` 不作为 C 默认引擎。它只接受火山服务器可访问的 `audio.url`，在 Reo 当前本地个人软件、不提供托管服务、用户只配置 X-Api-Key 的约束下无法作为默认产品路径。

流式 `volc.seedasr.sauc.duration` 不作为 finalized audio 文件补转录引擎。它继续只服务录音中的 live ASR。

## 理由

- Reo 当前目标用户是普通个人用户，用户只配置 X-Api-Key 即可使用语音能力。
- Reo 当前不提供付费托管服务，也不要求用户配置 TOS bucket、endpoint、region、AK 或 SK。
- 极速版官方接口支持 `audio.data` base64，能由 main process 直接提交本地录音文件内容，不需要公网 URL、对象存储或本地 HTTP 服务。
- 使用流式接口回放 20 分钟录音会接近实时耗时，属于规避文件识别约束的 workaround，不是 C 的产品路径。
- 极速版成本高于标准版，但它是当前唯一满足本地个人用户只配置 X-Api-Key 的官方文件识别路径；成本风险通过 batch cap、breaker、手动重试去重和诊断控制。

## 音频交付方案

Reo durable finalized audio 当前是 WebM/Opus `audio.webm`。极速版官方支持 WAV、MP3、OGG OPUS，不列 WebM。C 使用本地 ffmpeg binary 做 WebM/Opus → OGG/Opus remux：

```bash
ffmpeg -y -i input.webm -vn -c:a copy -f ogg output.ogg
```

该转换在 main process 内部执行。Renderer 不接触 raw path、audio bytes、base64、ffmpeg path 或 API key。转换产物使用临时目录，任务结束后清理。若 remux 失败，任务返回格式/转换 typed error，不 fallback 到公网 URL 或对象存储。

`@ffmpeg-installer/ffmpeg` 作为 runtime dependency 提供 app 随附 binary，避免要求新电脑用户预装系统 ffmpeg。FFmpeg CLI 参数依据官方 FFmpeg 文档中 `-i`、`-c:a copy` 与 stream copy 行为；依赖包信息来自 npm registry，描述为面向 Node projects 的 platform independent FFmpeg binary installer。

## 权限与验证结论

极速版 flash 路径需要用户的火山引擎账号具备 `volc.bigasr.auc_turbo` 权限。Reo 只要求用户保存新版控制台的 `X-Api-Key`，不收集旧控制台字段、TOS 配置或对象存储凭证。验证过程不得记录密钥、base64、raw path 或转录正文。

## 错误策略

- `20000000`：成功，读取 `result.text`。
- `20000003`：静音音频，映射为可恢复的空/静音结果，manifest 保持 failed。
- `45000001`：请求参数无效。
- `45000002`：空音频。
- `45000151`：音频格式不正确。
- `55000031`：服务器繁忙。
- `550XXXX`：服务端处理错误。
- HTTP 401/403 或认证语义：鉴权失败。
- HTTP 429 或服务端限流语义：限流。
- timeout、DNS、TLS、abort：按 timeout/network/abort 分类。

## 不在本 ADR 范围

- D More 菜单与确认弹层。
- transcript 写回合同变更。
- Segment 或 SegmentSupplement manifest schema 变更。
- 对象存储配置、平台代理服务或 TOS 上传 UX。

## 关联文档

- `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md` 记录直播转写 SeedASR SAUC 基线。
- `docs/archive/specs/2026-05-17-0512-doubao-voice-auto-backfill-turbo/` 记录 C 自动补转录 spec。
- 火山官方文档 `https://www.volcengine.com/docs/6561/1631584?lang=zh` 记录极速版同步接口与 `audio.data` 支持。
- 本地官方 Markdown 副本：`/Users/yck/Downloads/PM/技术线/reo文件区/大模型录音文件极速版识别API.md`
- 本地官方 demo 副本：`/Users/yck/Downloads/PM/技术线/reo文件区/auc_python/auc_flash_demo.py`
