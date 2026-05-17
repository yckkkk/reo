# Goal

确认 Reo 当前豆包流式语音识别 endpoint 三元组（`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async` + `volc.seedasr.sauc.duration` + `model_name: 'bigmodel'`）在火山引擎当前控制台规则下的合法性、计费窗口、并发限速与配额；产出 C0（后台引擎合同）选型必需的官方依据。

## 调研产出口径

1. **endpoint 合法性结论**：当前三元组是否需要调整。证据必须可链到 Context7 或火山官方文档当前版本。
2. **probe 计费结论**：A 保存时的最小 full-request probe（不发音频，等服务响应帧）是否计费；若计费，最小计费单位是什么；写回 spec 后必须同批回看 A 的 probe 行为是否需要修正（如改用更轻的握手）。
3. **并发/限速/配额结论**：当前账户访问该 endpoint 的并发上限、QPS、配额窗口；为 C0 的后台任务并发上限提供输入。
4. **离线/批处理引擎结论**：是否存在独立的离线 ASR endpoint；其语义、计费、输入格式差异；为 C0 引擎选型提供输入。

## 信息源优先级

按 CLAUDE.md 硬约束：

1. Context7 当前文档
2. 火山引擎当前官方文档
3. 火山引擎控制台 / SDK 源码

每条结论必须标注信息源、URL（如有）、访问日期、版本/时间戳。

## 不在范围

- UI / UX
- IPC contract
- B / C / D 任何实现工作
- 不重新讨论 A 的 locked decisions（BYOK、safeStorage、同窗口 Settings、toggle 默认 OFF、live session start 快照）
