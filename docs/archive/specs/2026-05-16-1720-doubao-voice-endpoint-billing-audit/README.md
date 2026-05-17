# 豆包流式语音识别 endpoint + probe 计费 + 并发限速调研

## 时间

2026-05-16 17:20 America/Los_Angeles

## 工作单元

Initiative `docs/initiatives/2026-05-16-doubao-voice-followups/` 中的 E：`bigmodel_async` vs `bigmodel` endpoint 校正。

按用户确认的新排序，E 提前到 B/C/D 之前执行：C 的引擎选型严重依赖 E 的官方文档结论，E 在后会导致 C 反复返工。

## 类型

纯技术调研 spec。

最终交付为：

1. 官方文档证据（Context7 → 火山官方文档 → 控制台/源码，按此优先级）
2. 决策记录（当前 endpoint / resource id / model_name 是否调整；probe 是否计费；后台并发上限给 C 的输入）
3. 若结论为"无需调整"，写入 `docs/decisions/` 并归档本 spec，不改代码
4. 若结论为"需要调整"，本 spec 内同批改代码、补测试、跑 `npm run verify:quick`

## 范围

| #   | 调研项                                                                                                                                    | 必答 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `bigmodel_async` 与 `bigmodel` 在火山引擎当前控制台/SDK 文档中的官方语义、资源 ID、计费窗口、延迟特征                                     | 是   |
| 2   | 当前 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async` + `volc.seedasr.sauc.duration` + `model_name: 'bigmodel'` 三元组是否合法 | 是   |
| 3   | 当前 BYOK 用户在保存 X-Api-Key 时执行的最小 full-request probe（不发音频）是否触发计费；若计费，最小计费单位                              | 是   |
| 4   | 火山引擎当前账户对该 endpoint 的并发上限、限速策略、配额窗口（为 C0 后台任务并发上限提供输入）                                            | 是   |
| 5   | 离线 / 批处理 ASR endpoint 是否存在；若存在，与当前 streaming endpoint 的语义/计费/输入格式差异（为 C0 引擎选型提供输入）                 | 是   |
| 6   | 当前 endpoint 在 streaming session 中断后续传的官方语义、可恢复窗口                                                                       | 否   |

## 范围外

- 任何 UI/UX 改动
- 任何 IPC contract 改动（除非调研结论强制要求）
- B/C/D 的实现内容

## Locked decisions（不在本 spec 内重新讨论）

- BYOK：用户自带 X-Api-Key，Reo 不持有平台密钥
- 安全：safeStorage、同窗口 Settings、保存时 probe、不使用环境变量凭证或双 header 鉴权、toggle 默认 OFF
- live session 一旦 start 完成就使用 start 时快照
- 不引入兼容垫片；endpoint 调整后旧值直接删除

## Stop conditions

1. 调研中发现需要平台密钥才能访问的 endpoint → 停下请示
2. 调研中发现 endpoint 调整需要破坏 A 的 locked decisions → 停下请示
3. Context7、火山官方文档、控制台三者结论冲突且无法调和 → 停下请示并记录证据
4. 实施类调整需要新增计划外依赖 → 停下请示

## Follow-up reserve

本 spec 只产出决策与可选实施；不扩展到 B/C/D。

- B：未转录状态可视化（含 B0 + 跨页面凭证失效提示）
- C：自动补转录（含 C0 引擎合同）
- D：More 菜单 + 手动重新生成
