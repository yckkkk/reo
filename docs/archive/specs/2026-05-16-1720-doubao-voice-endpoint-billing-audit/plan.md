# Plan

## 调研路径

按 CLAUDE.md 信息源优先级：Context7 当前文档（本次不可达，工具未注入）→ 火山引擎当前官方文档 → 火山引擎控制台 / SDK 源码。每条结论必须记录信息源、URL、访问日期、版本/时间戳。

### 1. endpoint 三元组合法性

目标：判断 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async` + `volc.seedasr.sauc.duration` + `model_name: 'bigmodel'` 是否为火山引擎当前控制台规则下的合法组合。

证据要求：

- `/api/v3/sauc/bigmodel_async` path 的官方文档存在
- `volc.seedasr.sauc.duration` resource id 的官方描述
- `model_name: 'bigmodel'` 在 full request payload 中的合法取值
- 该组合对应的功能描述（流式 vs 异步、实时 vs 离线）

### 2. probe 计费

目标：判断 A 保存 X-Api-Key 时执行的最小 full-request probe（不发音频，只等服务响应帧后断开）是否触发计费；若计费，最小计费单位是什么。

证据要求：

- 火山引擎流式语音识别计费规则
- 计费触发条件（按音频时长？按 session？按 connection？）
- 若按音频时长且 probe 无音频 → 不计费；否则按计费单位估算最小成本

依赖动作：

- 若 probe 计费 → 在 decision.md 提出更轻的握手替代（例如只 WebSocket open 不发 full request）
- 若 probe 不计费 → 在 decision.md 记录无需变更

### 3. 并发 / 限速 / 配额

目标：为 C0 后台任务并发上限提供输入。

证据要求：

- 该 endpoint 单账户并发上限
- QPS 限速策略
- 月度 / 日度配额窗口
- 限速错误码与重试建议

### 4. 离线 / 批处理 ASR endpoint

目标：判断是否存在独立的离线 ASR endpoint，差异在哪里；为 C0 引擎选型提供输入。

证据要求：

- 离线 ASR endpoint 是否存在
- 输入格式（URL 还是直接上传字节）
- 计费差异
- 与流式 endpoint 的延迟对比

### 5. 流式中断续传（次要）

目标：核对当前 5 秒 PCM buffer 自动重连策略是否符合官方建议。

## 决策分支

调研完成后，按以下分支处理：

### 分支 A：当前 endpoint 三元组合法且 probe 不计费

- 写入 `docs/decisions/000N-doubao-voice-endpoint-baseline.md`（编号在归档时确定）
- 写 `findings.md` + `decision.md` + `verification.md`
- 跑 `npm run verify:quick`（确认调研期间无意改动）
- 归档到 `docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/`

### 分支 B：当前 endpoint 三元组合法但 probe 计费

- 在本 spec 内修改 `voiceTranscriptionProbe.ts`，替换为更轻的握手（只 WS open + handshake response，不发 full request）
- 同批补单元测试（按 TDD：先写覆盖新行为的 probe 测试 → 失败 → 改实现 → 通过）
- 同批更新 `docs/current/electron.md` 中 probe 描述
- 跑 `npm run verify:quick`
- 写 decision.md + verification.md + 归档

### 分支 C：当前 endpoint 三元组需要调整

- 停下报告：调整 endpoint 涉及 `doubaoStreamingAsr.ts` 的 endpoint / resource id / model_name 之一或多个改造，需要重新 brainstorm 是否在本 spec 内实施还是另开 spec
- 不在本 spec 自动推进实施
- 写 findings.md 后停下请示

### 分支 D：调研中遇到需要登录的页面或证据冲突

- 记录到 findings.md 的"证据缺口"节
- 不为补全缺口推测官方语义
- 若关键证据无法获取，停下请示用户提供凭证或决定降级范围

## 验证

- `npm run verify:quick`（无论分支 A/B/C 都需运行；分支 D 视情况）
- 若进入分支 B：补 probe 单元测试，跑 `npm run test` 子集

## 同步

- decision.md 完成后，回看 A 的 `docs/archive/specs/2026-05-16-0605-doubao-voice-byok-settings/` 中关于 probe 行为的收口事实是否需要写入 `docs/current/electron.md` 的补充说明
- 若决策为"无需调整"，不写历史日志式解释，只在 decisions/ 中记录当前 endpoint 三元组、probe 行为、并发上限的当前事实
- 把"C0 后台任务并发上限输入"作为 follow-up 写回 initiative `plan.md`，供后续 C spec 直接消费

## 不做

- 不重新讨论 A 的 locked decisions（BYOK、safeStorage、同窗口 Settings、toggle 默认 OFF、live session start 快照）
- 不引入平台密钥
- 不恢复环境变量凭证或双 header 鉴权
- 不为了"验证"而触发付费的真实音频转录调用
