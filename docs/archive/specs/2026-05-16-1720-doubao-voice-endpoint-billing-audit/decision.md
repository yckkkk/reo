# Decision

## 决策

**决策分支 A：不改代码。** Reo 当前豆包流式语音识别 endpoint 三元组合法且为火山官方推荐配置；probe 行为短期保留；将 C0 引擎选型与并发上限的研究输入压缩为 follow-up 写回 initiative。

## 决策依据

参见 [findings.md](./findings.md)：

- Endpoint 三元组 `bigmodel_async` + `volc.seedasr.sauc.duration` + `model_name: 'bigmodel'` + 单 `X-Api-Key` header 对应 SeedASR 2.0 推荐流式识别配置
- Probe 在 duration 计费模型下推断不计费（按 0 秒音频时长）；证据为间接，需生产监控核实
- 当前续传策略（5 秒 PCM buffer + 裁剪重叠 chunk + 时间线连续）与流式 ASR 一般实践一致

## 不改的内容

- `src/main/doubaoStreamingAsr.ts` 的 endpoint / resource id / model_name / header 不变
- `src/main/voiceTranscriptionProbe.ts` 的 probe 行为不变
- `src/main/recordingTranscriptionSessions.ts` 的 live session 行为不变
- `docs/current/electron.md` 关于豆包 ASR 的当前事实不变

## 新增长期事实记录

在 `docs/decisions/` 写入一份当前事实 ADR，固化 endpoint 三元组、calibrate 依据和"为什么 SeedASR 2.0 而非 BigASR 1.0"的决策理由。ADR 编号在归档前由 archive 步骤确定。

ADR 内容要点：

- 当前豆包流式 ASR 选择 SeedASR 2.0（`bigmodel_async` + `volc.seedasr.sauc.duration`）
- 选择理由：火山官方推荐的下一代大模型
- 鉴权：单 `X-Api-Key` header（新版控制台标准）
- 计费：按音频时长 (`.duration`)，不依赖并发包月
- Probe：保存或主动 validate 时执行 full-request 握手；证据推断不触发计费

## Follow-up 写回 initiative

把以下输入压缩写回 `docs/initiatives/2026-05-16-doubao-voice-followups/plan.md` 的 C0 节，供后续 C spec 直接消费：

1. **C0 引擎选型建议**：优先评估离线极速版 `POST /api/v3/auc/bigmodel/recognize/flash` + resource id `volc.bigasr.auc_turbo`；该 endpoint 同步返回完整转录、直接接收 base64 编码音频字节（不需要公网 URL），与 Reo 本地文件真源原则契合。需 C0 spec 头部确认：
   - 是否存在 SeedASR 2.0 对应的离线极速版（与实时一致代）
   - 单次请求音频时长上限；超出上限需切换到异步 `auc/bigmodel/submit` + `auc/bigmodel/query`
   - 该 endpoint 是否同样接受 Reo 当前已保存的 X-Api-Key 鉴权（多数证据显示同一 BYOK 凭证可跨 SAUC/AUC 服务，但 C0 需直接验证）
2. **C0 后台并发上限建议**：初始 1（串行 FIFO 处理未转录集合）；不依赖并发包月；后续若用户购买更高配额，由 C 实现读取火山 QPS 查询接口 (`open.volcengineapi.com`) 调整
3. **C0 凭证一致性**：voice settings 中已保存的 X-Api-Key 当前只服务 streaming ASR；C0 必须在 spec 头部确认是否同 key 可服务离线 endpoint，或需要额外 settings 字段
4. **B0 状态语义模型未受 E 影响**：B 仍可独立推进；endpoint 决策不影响"未转录原因"语义建模

## 不引入的内容

- 不引入 runtime endpoint 自动切换
- 不引入 endpoint fallback
- 不引入平台密钥
- 不恢复环境变量凭证或双 header 鉴权
- 不为了"验证"触发付费的真实音频转录调用

## 证据缺口（已知并接受）

参见 findings.md 第 1/2/3/4 节末尾"证据缺口"列表。这些缺口不阻断当前"不改代码"决策；它们是 C0 spec 必须直接验证的开放问题。

## 验证

`npm run verify:quick` 必须通过，确认调研期间未无意改动代码。

## 不在本 spec 范围

- B（未转录状态可视化）
- C（自动补转录实施）
- D（More 菜单 + 手动重生）
- 任何 UI/UX 改动
- 任何 IPC contract 改动
