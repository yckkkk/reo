# Findings

调研日期：2026-05-16
调研者：Claude（Reo agent）
信息源采用依据：Context7 工具未在当前 toolset 注入；火山引擎官方文档站点 (volcengine.com/docs/6561/\*) 是 JS-rendered SPA，WebFetch 抓不到渲染后 DOM 内容；按 CLAUDE.md 降级到火山官方 SDK 仓库 + 火山官方接口说明文档（QPS/计费 FAQ 等可抓到的页面）+ 多个独立第三方开源项目交叉验证 + 中文技术博客示例代码。

## 一、Endpoint 三元组合法性

### 当前 Reo 代码事实

`src/main/doubaoStreamingAsr.ts:11-12`：

```typescript
export const DOUBAO_STREAMING_ASR_ENDPOINT =
  'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async';
export const DOUBAO_STREAMING_ASR_RESOURCE_ID = 'volc.seedasr.sauc.duration';
```

`src/main/doubaoStreamingAsr.ts:565`：`model_name: 'bigmodel'`

`src/main/doubaoStreamingAsr.ts:317`：header `X-Api-Key` + `X-Api-Connect-Id` + `X-Api-Resource-Id`。

### 火山引擎 Resource ID 命名规律

来源：mindfold-ai/open-typeless README（GitHub）

> volc.bigasr.sauc - 大模型 1.0 流式识别
> volc.seedasr.sauc - 大模型 2.0 流式识别 (推荐)

**结论 1**：`volc.seedasr.sauc.*` = SeedASR / 大模型 2.0 推荐版本；`volc.bigasr.sauc.*` = BigASR / 大模型 1.0 旧版本。两者均合法，但 2.0 是火山官方推荐。

### Endpoint 路径与 Resource ID 的配对

来源：

- missuo/koe README（与 Reo 一致）：`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async` + `volc.seedasr.sauc.duration`
- zhouruhui/volcengine-asr-ha 与 sipeed/picoclaw（1.0 版本）：`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel` + `volc.bigasr.sauc.duration`
- CSDN 博客示例（BigASR 1.0）：`sauc/bigmodel` + `volc.bigasr.sauc.duration` + `model_name: 'bigmodel'`

**结论 2**：endpoint 与 resource id 严格按版本配对。SeedASR 2.0 → `bigmodel_async`；BigASR 1.0 → `bigmodel`。

### Reo 当前三元组评估

| 项                 | Reo 当前值                                                | 评估                                                                                     | 依据                                                   |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| WebSocket endpoint | `/api/v3/sauc/bigmodel_async`                             | 合法（SeedASR 2.0 路径）                                                                 | missuo/koe                                             |
| Resource ID        | `volc.seedasr.sauc.duration`                              | 合法 + 推荐（2.0 新版）                                                                  | mindfold-ai/open-typeless                              |
| 鉴权 header        | 单 `X-Api-Key` + `X-Api-Connect-Id` + `X-Api-Resource-Id` | 合法（新版）                                                                             | giztoy/doubao-speech-go SDK（DOUBAO_API_KEY 鉴权方式） |
| `model_name`       | `'bigmodel'`                                              | 未在 SeedASR `bigmodel_async` 路径下找到官方文档原文，但与 missuo/koe 使用相同配置无问题 | 间接证据                                               |

**结论 3**：Reo 当前三元组与 SeedASR 2.0 推荐配置一致，**无需调整**。

### 证据缺口

- 火山官方文档站 (volcengine.com/docs/6561/1354869) 内容为 JS-rendered SPA，无法直接抓取原文逐字引用
- `model_name: 'bigmodel'` 在 SeedASR `bigmodel_async` 路径下的官方原文证据未直接获取；间接证据是与 SeedASR 2.0 默认配置一致的多个独立第三方实现都使用该值

## 二、Probe 是否计费

### 当前 Reo 代码事实

`src/main/voiceTranscriptionProbe.ts` 在用户保存 X-Api-Key 时执行最小握手：建立 WebSocket → 发送 full request frame（包含 audio config 但不发任何音频字节）→ 等服务响应帧 → 关闭 → 返回 ok/auth/network code。

### 火山官方计费规则

来源：火山引擎"计费FAQ" (volcengine.com/docs/6561/111524)

> Generally, unsuccessful service calls will not incur charges.

来源：火山引擎"计费说明"（搜索摘要）

> Streaming speech recognition and file recording recognition (including standard and speed versions) are charged on an hourly cumulative tiered usage basis.
> 按音频时长计费（duration 版本）

**结论 4**：duration 版本 = 按发送的音频时长累计计费。

### Probe 行为对照

- Probe 发送 full request frame 但**不发任何音频字节** → 音频时长 = 0 秒
- 按"0 秒 = 0 费用"逻辑推断，probe 不应触发计费
- 但 SAUC 服务是否对 connection 本身额外计费（独立于音频时长）官方未明示
- "不成功的调用不计费" 暗示**成功的握手**（服务端响应）可能进入计费范围

**结论 5**：probe 计费**证据不充分但推断不计费**。建议：

1. 短期保留当前 probe 行为不变（只在用户主动保存 X-Api-Key 或主动 validate 时触发，频率受控）
2. 用户首次部署后由用户自行核对火山控制台账单，确认是否有 probe 相关费用
3. 若未来发现 probe 计费，可切换到更轻的握手策略：只 WS open + handshake response，不发 full request；但需要权衡能否准确区分 `ok / auth / network`

### 证据缺口

- 火山官方文档未明确写出"WebSocket 建立连接但不发音频是否计费"
- 火山官方 SAUC 计费明细页（volcengine.com/docs/6561/1359370）是 SPA，无法直接抓取

## 三、并发 / 限速 / 配额

### 火山官方接口

来源：火山引擎"QPS/并发查询接口说明" (volcengine.com/docs/6561/1476626)

- Endpoint：`open.volcengineapi.com`
- Method：GET，HMAC-SHA256 签名
- 参数：`AppID`、`ResourceID`、`Start`/`End` 日期、`Mode`（daily/hourly/minutely/5minutely）
- 响应字段：`quota_monitoring` 数组，每项含 `value`（当前用量）和 `limit`（配额上限）
- ResourceID 命名规律：`volc.bigasr.sauc.concurrent`（流式并发版）、`volc.bigasr.sauc.duration`（按时长版）

来源：火山引擎"产品计费"页（搜索摘要）

> 火山引擎语音服务并发计费模式：1500 元/并发实例/月
> 默认 QPS：豆包语音识别模型 2.0 与大模型录音文件识别默认 max 20 QPS
> 30 分钟内提交音频时长 ≤ 500 小时

来源：搜索结果摘要

> 新版不再支持 concurrent 版本，使用 hourly/duration 版本

### Reo 当前事实

Reo 当前使用 `.duration` 版本（按音频时长计费），不依赖并发实例购买。C 的后台补转录任务理论上不消耗并发实例，但仍受 QPS 与每分钟音频时长上限约束。

**结论 6**：C0 后台并发上限建议初始为 **1（串行补转录）**：

- 不依赖用户购买并发实例
- 不消耗 free trial 配额
- 用户首次部署后由 C 的实现读取火山 QPS 查询接口动态调整（或维持串行直到用户在 settings 中明示需要并行）
- 串行实现可以让 C0 设计大幅简化：单 worker、单 in-flight task、按 FIFO 处理未转录集合

### 证据缺口

- BYOK 用户的具体免费配额未在公开文档查到
- `volc.seedasr.sauc.duration` 是否享有与 `volc.bigasr.sauc.duration` 相同的默认 QPS 未明示

## 四、离线 / 批处理 ASR endpoint

### 三个候选 endpoint

来源：搜索结果 + 火山官方"大模型录音文件极速版识别 API" (volcengine.com/docs/6561/1631584) 摘要 + 中文博客示例

| 模式               | Endpoint                                                          | Resource ID（2.0/1.0）                                     | 输入                   | 返回           |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------- | -------------- |
| 实时流式           | `wss://.../api/v3/sauc/bigmodel_async`                            | `volc.seedasr.sauc.duration` / `volc.bigasr.sauc.duration` | WebSocket PCM stream   | 流式增量片段   |
| 离线异步           | `POST /api/v3/auc/bigmodel/submit` + `/api/v3/auc/bigmodel/query` | `volc.seedasr.auc` / `volc.bigasr.auc`                     | audio URL 或 bytes     | task_id → poll |
| 离线极速版（同步） | `POST /api/v3/auc/bigmodel/recognize/flash`                       | `volc.bigasr.auc_turbo`                                    | URL 或 base64 编码字节 | 同步返回       |

### Reo 后台补转录 (C0) 引擎选型评估

C 的需求：对 Memory Space 中**已 finalized 的 `audio.webm`**（本地文件、无公网 URL、可能数百 MB）做异步补转录。

候选 1：**复用现有 streaming `bigmodel_async`**

- 实现：main process 解码 `audio.webm` 为 PCM，按时间线"假回放"喂给 streaming WS
- 缺点：占用 streaming connection 配额；按实时速率喂会很慢；需要复用大量现有 streaming 逻辑
- 优点：复用度高

候选 2：**离线异步 `auc/bigmodel/submit` + `auc/bigmodel/query`**

- 实现：HTTP POST 提交音频 bytes 或 URL，获取 task_id，轮询查询结果
- 缺点：需要二阶段轮询；提交 URL 模式要求公网可达（不适用于本地文件，违反 Reo "本地优先" 原则）；提交 bytes 模式可能有大小上限
- 优点：火山专为离线长音频设计

候选 3：**离线极速版 `auc/bigmodel/recognize/flash`** ★ 推荐

- 实现：HTTP POST 直接上传 base64 编码 `audio.webm` 字节，同步返回完整转录
- 缺点：仅 BigASR 1.0 (`auc_turbo`)，没有 SeedASR 2.0 极速版（需 C0 spec 确认是否有 2.0 极速版的更新）；可能有单次请求音频时长上限
- 优点：单 HTTP 请求即可、同步返回、直接接收字节（无需公网 URL）、与 Reo "本地文件真源" 原则高度契合

**结论 7**：C0 引擎选型推荐使用**离线极速版 `auc/bigmodel/recognize/flash` + `volc.bigasr.auc_turbo`**。这是 BigASR 1.0 路径下的服务，与 Reo 当前 streaming 用的 SeedASR 2.0 不同代，需要在 C0 spec 中确认：

1. 用户对"实时录音用 2.0 + 后台补转录用 1.0 极速版"的混用是否可接受
2. 是否存在 SeedASR 2.0 的对应离线极速版（spec 头部独立核实）
3. 单次极速版请求的音频时长上限；若 Reo 录音超出上限，需要切回 `auc/bigmodel/submit`（异步轮询）并先上传 bytes

### 证据缺口

- SeedASR 2.0 是否有对应的离线极速版未直接验证
- `auc/bigmodel/submit` 的 bytes 上传模式是否支持的 audio 字节大小上限未直接验证
- `auc/bigmodel/recognize/flash` 的单次请求音频时长上限未直接验证

## 五、流式中断续传（次要）

Reo 当前实现 (`docs/current/electron.md:123`) 在 streaming session 中断后续传时回放最近 5 秒 PCM buffer。火山官方未在可抓取的文档中明示推荐 buffer 时长；Reo 当前实现按"裁剪首个重叠 chunk + segment timestamp 继续落在原录音时间线"处理，与流式 ASR 一般实践一致，无需调整。

**结论 8**：当前续传策略**无需调整**。

## 六、汇总结论

| #   | 调研项                 | 结论                                                                            | 是否需要改 Reo 代码 |
| --- | ---------------------- | ------------------------------------------------------------------------------- | ------------------- |
| 1   | endpoint 三元组合法性  | Reo 当前 SeedASR 2.0 配置 = 火山官方推荐                                        | 否                  |
| 2   | probe 是否计费         | 推断不计费（按时长计 + 0 秒 = 0）；证据不充分；生产监控校验                     | 否（短期）          |
| 3   | 并发 / QPS / 配额      | C0 后台并发上限初始 1（串行）；后续按 QPS 查询接口动态调整                      | 否（C0 spec 落实）  |
| 4   | 离线 / 批处理 endpoint | 推荐用 `auc/bigmodel/recognize/flash` + `volc.bigasr.auc_turbo` 作为 C 后台引擎 | 否（C0 spec 落实）  |
| 5   | 流式中断续传           | 当前策略合理                                                                    | 否                  |

**总体结论：本次调研结果支持决策分支 A —— 当前 endpoint 三元组合法且 probe 不调整，不改代码；写入 docs/decisions/ 当前事实记录，把 C0 选型输入压缩为 follow-up 写回 initiative，归档本 spec。**

## 信息源清单

- mindfold-ai/open-typeless README — https://github.com/mindfold-ai/open-typeless/blob/main/README.md
- missuo/koe README — https://github.com/missuo/koe
- giztoy/doubao-speech-go (ASR V2 SAUC WS example) — https://pkg.go.dev/github.com/giztoy/doubao-speech-go/examples/asr_v2_sauc_ws
- zhouruhui/volcengine-asr-ha — https://github.com/zhouruhui/volcengine-asr-ha
- sipeed/picoclaw issue #1648 — https://github.com/sipeed/picoclaw/issues/1648
- 火山引擎 大模型流式语音识别 API — https://www.volcengine.com/docs/6561/1354869?lang=zh （SPA，无法直接抓取）
- 火山引擎 QPS/并发查询接口 — https://www.volcengine.com/docs/6561/1476626
- 火山引擎 计费FAQ — https://www.volcengine.com/docs/6561/111524
- 火山引擎 大模型录音文件极速版 API — https://www.volcengine.com/docs/6561/1631584
- 火山引擎 大模型录音文件识别标准版 API — https://www.volcengine.com/docs/6561/1354868?lang=zh （SPA）
- CSDN 博客 BigASR 1.0 Android 实现示例 — https://blog.csdn.net/weixin_40388758/article/details/147479391
- 博客园 火山引擎大模型 ASR 技术实践 — https://www.cnblogs.com/yangykaifa/p/19228598
